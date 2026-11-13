import {
  STARTER_MAP,
  TERRAIN_ASSETS,
  agricultureById,
  buildingById,
  canPlace,
  getAssetMeta,
  rotatedFootprint,
  screenToGrid,
} from "@nf/shared";
import Phaser from "phaser";
import { bundledPngIds, resolveAssetUrl } from "./assetUrls";
import { cropBobOffset } from "./bob";
import { cameraAction, clampZoom, worldFromScreen, zoomFromPinch, zoomFromWheel } from "./camera";
import {
  demoBuildings,
  demoPlacementCity,
  demoPlots,
  demoRoadTiles,
  placeableBuilding,
} from "./demoCity";
import { GROUND_DEPTH, ROAD_DEPTH, footprintDepth, overlayDepth } from "./depth";
import { ROAD_HINT_COLOR, ghostFeedback, nearestRoadCell, spriteFlipX } from "./ghost";
import { districtListSignal, lodMode, type LodMode } from "./lod";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y, anchorScreen, cellCenter, diamondPoints, displaySize, footprintCenter } from "./layout";
import { overlayColor, overlayForState } from "./overlays";
import { plotPresentation } from "./plots";
import { IDLE_GHOST, usePlacementStore, useSceneStore, type OverlayReadout } from "./scene-store";
import { firstOpaqueRow, labelTopRow, visibleArtTop } from "./spriteArt";

type Badge = {
  readonly id: string;
  readonly labelText: string;
  readonly icon: Phaser.GameObjects.Image | null;
  readonly label: Phaser.GameObjects.Text | null;
  readonly dot: Phaser.GameObjects.Arc;
  readonly detail: Phaser.GameObjects.Graphics | null;
};

type CropBob = {
  readonly icon: Phaser.GameObjects.Image;
  readonly baseY: number;
  readonly badge: Phaser.GameObjects.Image | null;
  readonly badgeBaseY: number;
  readonly ready: boolean;
};

const FULL_ICON = 28;
const DOT_ICON = 14;

function placeAnchored(
  scene: Phaser.Scene,
  assetId: string,
  gridX: number,
  gridY: number,
  footprintW: number,
  footprintH: number,
  depth: number,
  scale?: number,
): Phaser.GameObjects.Image {
  const meta = getAssetMeta(assetId);
  const image = scene.add.image(0, 0, assetId);
  const aspect = image.width === 0 ? 1 : image.height / image.width;
  const size = displaySize(footprintW, footprintH, scale ?? meta.displayScale, aspect);
  const anchor = anchorScreen(gridX, gridY, footprintW, footprintH);
  image.setOrigin(0.5, meta.pivotY);
  image.setDisplaySize(size.width, size.height);
  image.setPosition(anchor.x, anchor.y);
  image.setDepth(depth);
  return image;
}

function strokeDashed(
  graphics: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return false;
  }
  graphics.lineStyle(3, color, 1);
  const dash = 12;
  const gap = 8;
  let traveled = 0;
  while (traveled < length) {
    const start = traveled / length;
    const end = Math.min(length, traveled + dash) / length;
    graphics.beginPath();
    graphics.moveTo(x1 + dx * start, y1 + dy * start);
    graphics.lineTo(x1 + dx * end, y1 + dy * end);
    graphics.strokePath();
    traveled += dash + gap;
  }
  return true;
}

function paintDiamond(
  graphics: Phaser.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  width: number,
  height: number,
  color: number,
  fillAlpha: number,
): void {
  const points = diamondPoints(gridX, gridY, width, height);
  const first = points[0];
  if (first === undefined) {
    return;
  }
  graphics.fillStyle(color, fillAlpha);
  graphics.lineStyle(2, color, 1);
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

function opaqueRowOf(texture: Phaser.Textures.Texture): number {
  const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
  const width = source.width ?? 0;
  const height = source.height ?? 0;
  if (width === 0 || height === 0) {
    return 0;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return 0;
  }
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  return firstOpaqueRow(width, height, (x, y) => data[(y * width + x) * 4 + 3] ?? 0);
}

export class IsoScene extends Phaser.Scene {
  private reducedMotion = false;
  private disposed = false;
  private pointerWorld: { x: number; y: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { distance: number; zoom: number } | null = null;
  private drag: { x: number; y: number } | null = null;
  private badges: Badge[] = [];
  private readonly buildingSprites: { id: string; image: Phaser.GameObjects.Image }[] = [];
  private aimNonce = 0;
  private unsubscribeAim: (() => void) | null = null;
  private readyCrop: CropBob | null = null;
  private lod: LodMode = "detailed";
  private unsubscribe: (() => void) | null = null;
  private host: HTMLElement | null = null;
  private ghostImage: Phaser.GameObjects.Image | null = null;
  private ghostIcon: Phaser.GameObjects.Image | null = null;
  private ghostLabel: Phaser.GameObjects.Text | null = null;
  private ghostHint: Phaser.GameObjects.Graphics | null = null;
  private ghostFoot: Phaser.GameObjects.Graphics | null = null;
  private ghostStamp: number | null = null;
  private readonly opaqueRows = new Map<string, number>();

  constructor() {
    super("iso");
  }

  public init(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dispose();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.dispose();
    });
  }

  public preload(): void {
    this.load.on("loaderror", (file: { key: string }) => {
      useSceneStore.getState().publish({ error: `failed to load ${file.key}` });
    });
    for (const assetId of bundledPngIds()) {
      this.load.image(assetId, resolveAssetUrl(assetId));
    }
  }

  public create(): void {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.drawTerrain();
    this.drawRoads();
    this.drawPlots();
    this.drawBuildings();
    this.createGhost();
    const camera = this.cameras.main;
    const framed = cellCenter(8, 8);
    camera.centerOn(framed.x, framed.y);
    camera.roundPixels = true;
    this.bindInput();
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.onPaint);
    this.unsubscribe = usePlacementStore.subscribe(() => {
      this.ghostStamp = performance.now();
      this.refreshGhost();
    });
    this.unsubscribeAim = useSceneStore.subscribe((state) => {
      const aim = state.aim;
      if (aim === null || aim.nonce === this.aimNonce) {
        return;
      }
      this.aimNonce = aim.nonce;
      this.cameras.main.setZoom(clampZoom(aim.zoom));
      this.cameras.main.centerOn(aim.x, aim.y);
      this.publishCamera();
    });
    this.publishWorld();
    if (!this.disposed) {
      useSceneStore.getState().publish({ ready: true, error: "" });
    }
  }

  public override update(time: number): void {
    const crop = this.readyCrop;
    if (crop === null) {
      return;
    }
    const offset = cropBobOffset(time, crop.ready, this.reducedMotion);
    crop.icon.setY(crop.baseY + offset);
    crop.badge?.setY(crop.badgeBaseY + offset);
    const published = Math.round(offset * 100) / 100;
    if (published !== useSceneStore.getState().cropOffset) {
      useSceneStore.getState().publish({ cropOffset: published });
    }
  }

  private drawTerrain(): void {
    for (let y = 0; y < STARTER_MAP.height; y += 1) {
      const row = STARTER_MAP.rows[y];
      if (row === undefined) {
        continue;
      }
      for (let x = 0; x < STARTER_MAP.width; x += 1) {
        const terrain = row[x];
        if (terrain === undefined) {
          continue;
        }
        placeAnchored(this, TERRAIN_ASSETS[terrain], x, y, 1, 1, GROUND_DEPTH);
      }
    }
  }

  private drawRoads(): void {
    for (const road of demoRoadTiles()) {
      const image = placeAnchored(this, road.sprite.assetId, road.x, road.y, 1, 1, ROAD_DEPTH);
      image.setFlip(road.sprite.flipX, road.sprite.flipY);
    }
  }

  private drawPlots(): void {
    for (const plot of demoPlots()) {
      const definition = agricultureById(plot.plotId);
      const presentation = plotPresentation(plot.plotId);
      for (let dy = 0; dy < definition.footprint.height; dy += 1) {
        for (let dx = 0; dx < definition.footprint.width; dx += 1) {
          placeAnchored(this, presentation.groundAssetId, plot.x + dx, plot.y + dy, 1, 1, GROUND_DEPTH + 10);
        }
      }
      const depth = footprintDepth(plot.x, plot.y, definition.footprint.width, definition.footprint.height);
      if (presentation.propAssetId !== null) {
        placeAnchored(
          this,
          presentation.propAssetId,
          plot.x,
          plot.y,
          definition.footprint.width,
          definition.footprint.height,
          depth,
        );
      }
      const center = footprintCenter(plot.x, plot.y, definition.footprint.width, definition.footprint.height);
      const icon = this.add.image(center.x, center.y, presentation.overlayAssetId);
      const aspect = icon.width === 0 ? 1 : icon.height / icon.width;
      const size = displaySize(
        definition.footprint.width,
        definition.footprint.height,
        presentation.overlayScale,
        aspect,
      );
      icon.setOrigin(0.5, 0.5);
      icon.setDisplaySize(size.width, size.height);
      icon.setDepth(overlayDepth(depth));
      let badge: Phaser.GameObjects.Image | null = null;
      if (plot.ready) {
        badge = this.add.image(center.x + 36, center.y - 20, "ico_ui_check");
        badge.setOrigin(0.5, 0.5);
        badge.setDisplaySize(24, 24);
        badge.setDepth(overlayDepth(depth));
        this.badges.push({
          id: plot.instanceId,
          labelText: "Ready",
          icon: badge,
          label: this.statusText(center.x + 52, center.y - 36, "Ready", overlayDepth(depth)),
          dot: this.statusDot(center.x, center.y - 48, overlayColor("ready"), overlayDepth(depth)),
          detail: null,
        });
      }
      if (plot.ready) {
        this.readyCrop = { icon, baseY: center.y, badge, badgeBaseY: badge?.y ?? center.y, ready: true };
      }
    }
  }

  private drawBuildings(): void {
    for (const building of demoBuildings()) {
      const definition = buildingById(building.buildingId);
      const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, building.rotation);
      const depth = footprintDepth(building.x, building.y, footprint.width, footprint.height);
      const image = placeAnchored(this, definition.assetId, building.x, building.y, footprint.width, footprint.height, depth);
      image.setFlipX(spriteFlipX(building.rotation));
      this.buildingSprites.push({ id: building.instanceId, image });
      const overlay = overlayForState(building.state, building.timerLabel);
      if (overlay === null) {
        continue;
      }
      const artTop = this.artTop(image);
      const color = overlayColor(overlay.marker);
      let detail: Phaser.GameObjects.Graphics | null = null;
      if (overlay.marker === "construction") {
        detail = this.add.graphics();
        detail.setDepth(overlayDepth(depth));
        paintDiamond(detail, building.x, building.y, footprint.width, footprint.height, color, 0.28);
      }
      const icon =
        overlay.icon === null
          ? null
          : this.add
              .image(image.x - 20, artTop - FULL_ICON / 2 - 2, overlay.icon)
              .setDisplaySize(FULL_ICON, FULL_ICON)
              .setOrigin(0.5, 0.5)
              .setDepth(overlayDepth(depth));
      const label = this.statusText(image.x, artTop - 2, overlay.text, overlayDepth(depth));
      const dot = this.statusDot(image.x, artTop + 10, color, overlayDepth(depth));
      this.badges.push({ id: building.instanceId, labelText: overlay.text, icon, label, dot, detail });
    }
  }

  private statusText(x: number, y: number, text: string, depth: number): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#1b1f2a",
      backgroundColor: "#f4f1ea",
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0, 1);
    label.setDepth(depth);
    return label;
  }

  private statusDot(x: number, y: number, color: number, depth: number): Phaser.GameObjects.Arc {
    const dot = this.add.circle(x, y, 6, color);
    dot.setDepth(depth);
    dot.setVisible(false);
    return dot;
  }

  private createGhost(): void {
    this.ghostImage = this.add.image(0, 0, "bld_res_cottage").setVisible(false);
    this.ghostIcon = this.add.image(0, 0, "ico_ui_check").setDisplaySize(FULL_ICON, FULL_ICON).setVisible(false);
    this.ghostLabel = this.add
      .text(0, 0, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#1b1f2a",
        backgroundColor: "#f4f1ea",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0, 1)
      .setVisible(false);
    this.ghostHint = this.add.graphics();
    this.ghostFoot = this.add.graphics();
  }

  private bindInput(): void {
    const host = this.game.canvas.parentElement;
    if (host === null) {
      throw new Error("game canvas has no parent");
    }
    this.host = host;
    host.addEventListener("pointerdown", this.onPointerDown);
    host.addEventListener("pointermove", this.onPointerMove);
    host.addEventListener("pointerup", this.onPointerUp);
    host.addEventListener("pointercancel", this.onPointerUp);
    host.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", this.onMotion);
  }

  private readonly onMotion = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    useSceneStore.getState().publish({ reducedMotion: event.matches });
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const action = cameraAction({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });
    if (action === null || (event.repeat && action.type !== "pan")) {
      return;
    }
    switch (action.type) {
      case "rotate":
        usePlacementStore.getState().rotate();
        break;
      case "cancel":
        usePlacementStore.getState().cancel();
        break;
      case "pan":
        this.cameras.main.scrollX += action.x / this.cameras.main.zoom;
        this.cameras.main.scrollY += action.y / this.cameras.main.zoom;
        this.publishCamera();
        break;
      default: {
        const unreachable: never = action;
        throw new Error(`unhandled camera action ${String(unreachable)}`);
      }
    }
    event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.cameras.main.setZoom(zoomFromWheel(this.cameras.main.zoom, event.deltaY));
    this.publishCamera();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.drag = { x: event.clientX, y: event.clientY };
    this.pinchStart = null;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.drag = null;
    this.pinchStart = null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.ghostStamp = performance.now();
    const previous = this.pointers.get(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size >= 2) {
      this.applyPinch();
    } else if (this.drag !== null && previous !== undefined && (event.buttons & 1) === 1) {
      const zoom = this.cameras.main.zoom || 1;
      this.cameras.main.scrollX -= (event.clientX - this.drag.x) / zoom;
      this.cameras.main.scrollY -= (event.clientY - this.drag.y) / zoom;
      this.drag = { x: event.clientX, y: event.clientY };
      this.publishCamera();
    }
    this.pointerWorld = this.worldFromClient(event.clientX, event.clientY);
    this.refreshGhost();
  };

  private readonly onPaint = (): void => {
    if (this.ghostStamp === null) {
      return;
    }
    const latencyMs = Math.max(0, Math.round(performance.now() - this.ghostStamp));
    this.ghostStamp = null;
    const ghost = useSceneStore.getState().ghost;
    useSceneStore.getState().publish({ ghost: { ...ghost, latencyMs } });
  };

  private applyPinch(): void {
    const points = [...this.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (first === undefined || second === undefined) {
      return;
    }
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (this.pinchStart === null) {
      this.pinchStart = { distance, zoom: this.cameras.main.zoom };
      return;
    }
    this.cameras.main.setZoom(zoomFromPinch(this.pinchStart.zoom, this.pinchStart.distance, distance));
    this.publishCamera();
  }

  private worldFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const camera = this.cameras.main;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width === 0 ? 1 : rect.width / canvas.width;
    const scaleY = canvas.height === 0 ? 1 : rect.height / canvas.height;
    const canvasX = (clientX - rect.left) / scaleX;
    const canvasY = (clientY - rect.top) / scaleY;
    return worldFromScreen(
      canvasX,
      canvasY,
      camera.scrollX,
      camera.scrollY,
      camera.zoom,
      camera.width,
      camera.height,
      camera.x,
      camera.y,
    );
  }

  private artTop(image: Phaser.GameObjects.Image): number {
    return visibleArtTop(image.y, image.displayHeight, image.originY, image.height, labelTopRow(image.texture.key, this.opaqueRow(image.texture.key)));
  }

  private opaqueRow(key: string): number {
    const cached = this.opaqueRows.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const row = opaqueRowOf(this.textures.get(key));
    this.opaqueRows.set(key, row);
    return row;
  }

  private refreshGhost(): void {
    const image = this.ghostImage;
    const icon = this.ghostIcon;
    const label = this.ghostLabel;
    const hint = this.ghostHint;
    const foot = this.ghostFoot;
    if (image === null || icon === null || label === null || hint === null || foot === null) {
      return;
    }
    const placement = usePlacementStore.getState();
    const previousLatency = useSceneStore.getState().ghost.latencyMs;
    if (placement.catalogId === null || this.pointerWorld === null) {
      image.setVisible(false);
      icon.setVisible(false);
      label.setVisible(false);
      hint.clear();
      foot.clear();
      useSceneStore.getState().publish({
        ghost: { ...IDLE_GHOST, latencyMs: previousLatency },
      });
      return;
    }
    const grid = screenToGrid(this.pointerWorld.x, this.pointerWorld.y, MAP_ORIGIN_X, MAP_ORIGIN_Y);
    const definition = placeableBuilding(placement.catalogId);
    const footprint = rotatedFootprint(definition.footprint.width, definition.footprint.height, placement.rotation);
    const result = canPlace(demoPlacementCity(), definition, grid.gx, grid.gy, placement.rotation);
    const feedback = ghostFeedback(result);
    const assetId = buildingById(placement.catalogId).assetId;
    const meta = getAssetMeta(assetId);
    image.setTexture(assetId);
    const aspect = image.width === 0 ? 1 : image.height / image.width;
    const size = displaySize(footprint.width, footprint.height, meta.displayScale, aspect);
    const anchor = anchorScreen(grid.gx, grid.gy, footprint.width, footprint.height);
    const depth = overlayDepth(footprintDepth(grid.gx, grid.gy, footprint.width, footprint.height));
    image.setOrigin(0.5, meta.pivotY);
    image.setDisplaySize(size.width, size.height);
    image.setPosition(anchor.x, anchor.y);
    image.setFlipX(spriteFlipX(placement.rotation));
    image.setTint(feedback.tint);
    image.setAlpha(0.75);
    image.setDepth(depth);
    image.setVisible(true);
    icon.setTexture(feedback.icon);
    const artTop = visibleArtTop(anchor.y, size.height, meta.pivotY, image.height, this.opaqueRow(assetId));
    icon.setPosition(anchor.x - 18, artTop - 16);
    icon.setDepth(depth);
    icon.setVisible(true);
    label.setText(feedback.text);
    label.setPosition(anchor.x + 2, artTop - 2);
    label.setDepth(depth);
    label.setVisible(true);
    foot.clear();
    foot.setDepth(depth);
    paintDiamond(foot, grid.gx, grid.gy, footprint.width, footprint.height, feedback.tint, 0.2);
    hint.clear();
    hint.setDepth(depth);
    let roadHintDrawn = false;
    if (feedback.roadHint) {
      const nearest = nearestRoadCell(
        { x: grid.gx, y: grid.gy, width: footprint.width, height: footprint.height },
        demoPlacementCity().roads,
      );
      if (nearest !== null) {
        const from = footprintCenter(grid.gx, grid.gy, footprint.width, footprint.height);
        const to = cellCenter(nearest.x, nearest.y);
        roadHintDrawn = strokeDashed(hint, from.x, from.y, to.x, to.y, ROAD_HINT_COLOR);
      }
    }
    useSceneStore.getState().publish({
      ghost: {
        active: true,
        x: grid.gx,
        y: grid.gy,
        rotation: placement.rotation,
        flipX: spriteFlipX(placement.rotation),
        footprint: `${footprint.width}x${footprint.height}`,
        tone: feedback.tone,
        text: feedback.text,
        icon: feedback.icon,
        roadHint: roadHintDrawn,
        latencyMs: previousLatency,
      },
    });
  }

  private publishCamera(): void {
    const camera = this.cameras.main;
    const mode = lodMode(camera.zoom);
    if (mode !== this.lod) {
      this.lod = mode;
      this.applyLod(mode);
    }
    useSceneStore.getState().publish({
      zoom: camera.zoom,
      lod: mode,
      districtList: districtListSignal(camera.zoom),
      scrollX: Math.round(camera.scrollX),
      scrollY: Math.round(camera.scrollY),
    });
  }

  private applyLod(mode: LodMode): void {
    const readouts: OverlayReadout[] = [];
    for (const badge of this.badges) {
      const collapsed = mode === "collapsed";
      badge.label?.setVisible(!collapsed);
      badge.detail?.setVisible(!collapsed);
      badge.dot.setVisible(collapsed && badge.icon === null);
      if (badge.icon !== null) {
        const size = collapsed ? DOT_ICON : FULL_ICON;
        badge.icon.setDisplaySize(size, size);
        badge.icon.setVisible(true);
      }
      readouts.push({
        id: badge.id,
        state: badge.labelText,
        text: badge.labelText,
        kind: mode === "collapsed" ? "dot" : "full",
        label: badge.labelText,
      });
    }
    useSceneStore.getState().publish({ overlays: readouts, lod: mode, districtList: mode === "collapsed" });
  }

  private spriteDepthOrder(): string {
    return this.buildingSprites
      .map((entry) => ({ id: entry.id, depth: entry.image.depth }))
      .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id))
      .map((entry) => `${entry.id}:${entry.depth}`)
      .join(",");
  }

  private publishWorld(): void {
    const order = this.spriteDepthOrder();
    this.lod = "detailed";
    this.applyLod("detailed");
    useSceneStore.getState().publish({
      ready: false,
      reducedMotion: this.reducedMotion,
      depthOrder: order,
      mapSize: `${STARTER_MAP.width}x${STARTER_MAP.height}`,
      zoom: this.cameras.main.zoom,
      lod: "detailed",
      districtList: false,
      scrollX: Math.round(this.cameras.main.scrollX),
      scrollY: Math.round(this.cameras.main.scrollY),
      ghost: IDLE_GHOST,
      cropOffset: 0,
    });
  }

  private dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeAim?.();
    this.unsubscribeAim = null;
    const host = this.host;
    if (host !== null) {
      host.removeEventListener("pointerdown", this.onPointerDown);
      host.removeEventListener("pointermove", this.onPointerMove);
      host.removeEventListener("pointerup", this.onPointerUp);
      host.removeEventListener("pointercancel", this.onPointerUp);
      host.removeEventListener("wheel", this.onWheel);
    }
    window.removeEventListener("keydown", this.onKeyDown);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPaint);
    window.matchMedia("(prefers-reduced-motion: reduce)").removeEventListener("change", this.onMotion);
    useSceneStore.getState().publish({ ready: false });
  }
}

export function createIsoGame(parent: HTMLElement): Phaser.Game {
  const width = parent.clientWidth > 0 ? parent.clientWidth : 960;
  const height = parent.clientHeight > 0 ? parent.clientHeight : 540;
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width,
    height,
    backgroundColor: "#8fb4d4",
    banner: false,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width,
      height,
    },
    scene: [IsoScene],
  });
}
