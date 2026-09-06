# -*- coding: utf-8 -*-
"""Generate promo-style DC connect demo canvas (dark stage + SHOT)."""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ASSETS = Path(r"e:/判充/assets/connect")
OUT = Path(r"C:/Users/admin/.cursor/projects/e/canvases/connect-process-demo.canvas.tsx")

TEMPLATE = r'''import {
  Button,
  Divider,
  Grid,
  H1,
  Pill,
  Row,
  Spacer,
  Stack,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type PinState = "off" | "pending" | "ok" | "fail";
type TabKey = "process" | "standard" | "coords";
type CutKey = "idle" | "seated" | "ok" | "charging" | "fail";

type Phase = {
  key: string;
  ep: string;
  title: string;
  narration: string;
  car: string;
  tip: string;
  caption: string;
  cut: CutKey;
  pins: Record<string, PinState>;
  lockBtn: PinState;
  lockPin: PinState;
};

/** 产品片定版色（对齐 pages/dcflow 暗场舞台） */
const C = {
  stage: "#121418",
  stageLine: "#2A2F36",
  hud: "#E6D7B4",
  hudDim: "rgba(230,215,180,0.55)",
  hudBlue: "#B4D2FF",
  gold: "#C8A45A",
  chip: "#1A1A1A",
  ok: "#1DBF6E",
  pending: "#4C8DFF",
  fail: "#E85D5D",
  off: "#5A616A",
  face: "#2A2E34",
  metal: "#8A8476",
  ink: "#F2EDE3",
  mute: "rgba(242,237,227,0.55)",
};

const FACE_OD = 65;
const CONTACTS: {
  key: string;
  no: number;
  x: number;
  y: number;
  hole: number;
  pin: number;
  role: string;
}[] = [
  { key: "DC+", no: 1, x: -16.0, y: 14.5, hole: 25.4, pin: 12.0, role: "直流电源正" },
  { key: "DC-", no: 2, x: 16.0, y: 14.5, hole: 25.4, pin: 12.0, role: "直流电源负" },
  { key: "PE", no: 3, x: 0.0, y: 0.0, hole: 15.6, pin: 8.0, role: "保护接地" },
  { key: "S+", no: 4, x: -13.5, y: -15.0, hole: 10.3, pin: 3.6, role: "充电通信 CAN_H" },
  { key: "S-", no: 5, x: 13.5, y: -15.0, hole: 10.3, pin: 3.6, role: "充电通信 CAN_L" },
  { key: "CC1", no: 6, x: -20.5, y: -1.0, hole: 10.3, pin: 3.6, role: "充电连接确认" },
  { key: "CC2", no: 7, x: 20.5, y: -1.0, hole: 10.3, pin: 3.6, role: "充电连接确认" },
  { key: "A+", no: 8, x: -13.5, y: -28.0, hole: 10.3, pin: 3.6, role: "低压辅助电源正" },
  { key: "A-", no: 9, x: 13.5, y: -28.0, hole: 10.3, pin: 3.6, role: "低压辅助电源负" },
];

const PIN_ORDER = ["DC+", "DC-", "PE", "CC1", "CC2", "S+", "S-", "A+", "A-"];

const IMG = {
  idle: "data:image/jpeg;base64,__IMG_IDLE__",
  seated: "data:image/jpeg;base64,__IMG_SEATED__",
  ok: "data:image/jpeg;base64,__IMG_OK__",
  charging: "data:image/jpeg;base64,__IMG_CHARGING__",
  fail: "data:image/jpeg;base64,__IMG_FAIL__",
  a1: "data:image/jpeg;base64,__IMG_A1__",
  fig9: "data:image/jpeg;base64,__IMG_FIG9__",
};

const A1_W = __A1_W__;
const A1_H = __A1_H__;
const FIG9_W = __FIG9_W__;
const FIG9_H = __FIG9_H__;

let demoPlayToken = 0;

function offAll(): Record<string, PinState> {
  const m: Record<string, PinState> = {};
  PIN_ORDER.forEach((k) => {
    m[k] = "off";
  });
  return m;
}

function withPins(base: Record<string, PinState>, patch: Record<string, PinState>) {
  return { ...base, ...patch };
}

const PHASES: Phase[] = [
  {
    key: "idle",
    ep: "01",
    title: "准备插枪",
    narration: "充电开始前，车还在等待一根枪的到来。",
    car: "车辆待机，充电口待命",
    tip: "认孔 · 对照国标 9 触头",
    caption: "枪与座分离",
    cut: "idle",
    pins: offAll(),
    lockBtn: "off",
    lockPin: "off",
  },
  {
    key: "press",
    ep: "02",
    title: "按压锁止键",
    narration: "先按下枪上的锁止键，才能顺利插入。",
    car: "充电口尚未受力",
    tip: "锁止机构释放中",
    caption: "按下枪头锁止键",
    cut: "idle",
    pins: offAll(),
    lockBtn: "pending",
    lockPin: "off",
  },
  {
    key: "insert",
    ep: "03",
    title: "插入充电枪",
    narration: "枪头推进充电口，金属触点开始靠近。",
    car: "机械连接正在建立",
    tip: "正在插接 · PE 先接触",
    caption: "枪头进入充电口",
    cut: "seated",
    pins: withPins(offAll(), { PE: "pending" }),
    lockBtn: "ok",
    lockPin: "off",
  },
  {
    key: "seated",
    ep: "04",
    title: "机械到位",
    narration: "插接到位了——车和桩，物理上连在一起。",
    car: "PE 等触点开始接触",
    tip: "机械连接完成 · PE 已通",
    caption: "插接到位",
    cut: "seated",
    pins: withPins(offAll(), { PE: "ok" }),
    lockBtn: "ok",
    lockPin: "pending",
  },
  {
    key: "lock",
    ep: "05",
    title: "电子锁锁止",
    narration: "电子锁落下，防止充电中意外拔枪。",
    car: "枪被锁住，连接更可靠",
    tip: "电子锁已锁 · 不可拔出",
    caption: "锁销落下",
    cut: "ok",
    pins: withPins(offAll(), { PE: "ok" }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "cc1",
    ep: "06",
    title: "CC1 识别",
    narration: "车端通过 CC1 确认：有枪插好了。",
    car: "BMS/整车感知连接状态",
    tip: "CC1 接通中",
    caption: "车端连接确认",
    cut: "ok",
    pins: withPins(offAll(), { PE: "ok", CC1: "pending" }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "cc2",
    ep: "07",
    title: "CC2 识别",
    narration: "桩端通过 CC2 确认连接完整。",
    car: "车桩双方都认可「已插好」",
    tip: "CC1 / CC2 均已确认",
    caption: "桩端连接确认",
    cut: "ok",
    pins: withPins(offAll(), { PE: "ok", CC1: "ok", CC2: "ok" }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "aux",
    ep: "08",
    title: "辅助与通信",
    narration: "低压辅助 A± 与 CAN（S±）接通，给车端控制器供电。",
    car: "低压唤醒，准备通信",
    tip: "A± / S± 接通",
    caption: "辅助电源与通信通路",
    cut: "ok",
    pins: withPins(offAll(), {
      PE: "ok",
      CC1: "ok",
      CC2: "ok",
      "A+": "ok",
      "A-": "ok",
      "S+": "ok",
      "S-": "ok",
    }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "handshake",
    ep: "09",
    title: "握手交换",
    narration: "车和桩开始握手：交换协议版本与能力边界。",
    car: "BMS 与充电机互相确认身份",
    tip: "CAN 握手中",
    caption: "CHM / BHM",
    cut: "ok",
    pins: withPins(offAll(), {
      PE: "ok",
      CC1: "ok",
      CC2: "ok",
      "A+": "ok",
      "A-": "ok",
      "S+": "ok",
      "S-": "ok",
    }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "relay",
    ep: "10",
    title: "继电器闭合",
    narration: "双方就绪后，高压继电器闭合——准备上电。",
    car: "高压回路即将导通",
    tip: "DC± 接通中",
    caption: "BRO / CRO 就绪",
    cut: "charging",
    pins: withPins(offAll(), {
      PE: "ok",
      CC1: "ok",
      CC2: "ok",
      "A+": "ok",
      "A-": "ok",
      "S+": "ok",
      "S-": "ok",
      "DC+": "pending",
      "DC-": "pending",
    }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "charge",
    ep: "11",
    title: "上高压充电",
    narration: "电流真正进入电池：车在「吃电」，桩在「送电」。",
    car: "按需求电压/电流持续充电",
    tip: "高压通路建立",
    caption: "BCL / CCS 大电流",
    cut: "charging",
    pins: withPins(offAll(), {
      PE: "ok",
      CC1: "ok",
      CC2: "ok",
      "A+": "ok",
      "A-": "ok",
      "S+": "ok",
      "S-": "ok",
      "DC+": "ok",
      "DC-": "ok",
    }),
    lockBtn: "ok",
    lockPin: "ok",
  },
  {
    key: "fail",
    ep: "断点",
    title: "断点示例 · CC2",
    narration: "CC2 标红：断点定位，后续步骤不再推进。",
    car: "倾向：连接问题（不定责）",
    tip: "断点：CC2 异常",
    caption: "连接断点示意",
    cut: "fail",
    pins: withPins(offAll(), { PE: "ok", CC1: "ok", CC2: "fail" }),
    lockBtn: "ok",
    lockPin: "ok",
  },
];

function pinColor(st: PinState) {
  if (st === "ok") return C.ok;
  if (st === "pending") return C.pending;
  if (st === "fail") return C.fail;
  return C.off;
}

function pinLabel(st: PinState) {
  if (st === "fail") return "异常";
  if (st === "ok") return "已通";
  if (st === "pending") return "接通中";
  return "未通";
}

function FaceMini({ phase }: { phase: Phase }) {
  const vb = 100;
  const scale = 1.2;
  const toX = (x: number) => 50 + x * scale;
  const toY = (y: number) => 48 - y * scale;
  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width="100%" style={{ display: "block" }}>
      <circle
        cx={50}
        cy={48}
        r={(FACE_OD / 2) * scale}
        fill={C.face}
        stroke={C.hudDim}
        strokeWidth={1}
      />
      <rect
        x={45}
        y={48 - (FACE_OD / 2) * scale - 3.5}
        width={10}
        height={3.5}
        fill={pinColor(phase.lockPin === "off" ? phase.lockBtn : phase.lockPin)}
      />
      {CONTACTS.map((p) => {
        const st = phase.pins[p.key] || "off";
        const cx = toX(p.x);
        const cy = toY(p.y);
        return (
          <g key={p.key}>
            <circle
              cx={cx}
              cy={cy}
              r={(p.hole / 2) * scale}
              fill={pinColor(st)}
              opacity={st === "off" ? 0.35 : 0.95}
            />
            <circle cx={cx} cy={cy} r={(p.pin / 2) * scale} fill={C.metal} />
          </g>
        );
      })}
    </svg>
  );
}

function Stage({ phase }: { phase: Phase }) {
  const src = IMG[phase.cut];
  return (
    <div
      style={{
        position: "relative",
        background: C.stage,
        border: `1px solid ${C.stageLine}`,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%", paddingBottom: "66.67%" }}>
        <img
          src={src}
          alt={phase.title}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: C.stage,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            top: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              color: C.hud,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            3D CUTAWAY · {phase.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: C.hudBlue,
              textAlign: "right",
              maxWidth: "48%",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            {phase.tip}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 12,
            textAlign: "center",
            fontSize: 12,
            letterSpacing: 1,
            color: C.hud,
            pointerEvents: "none",
          }}
        >
          {phase.caption}
        </div>
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 36,
            fontSize: 10,
            letterSpacing: 1.5,
            color: "rgba(210,190,150,0.75)",
            border: "1px solid rgba(210,190,150,0.3)",
            padding: "3px 8px",
            background: "rgba(0,0,0,0.45)",
          }}
        >
          半剖示意
        </div>
      </div>
    </div>
  );
}

function PinChips({ phase }: { phase: Phase }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {PIN_ORDER.map((k) => {
        const st = phase.pins[k] || "off";
        const on = st !== "off";
        return (
          <span
            key={k}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 10px",
              background: C.chip,
              color: on ? pinColor(st) : C.off,
              border: `1px solid ${on ? pinColor(st) : C.stageLine}`,
              letterSpacing: 0.3,
            }}
          >
            {k}
          </span>
        );
      })}
    </div>
  );
}

function LockRow({ phase }: { phase: Phase }) {
  const items = [
    { name: "按压锁止键", st: phase.lockBtn },
    { name: "锁销", st: phase.lockPin },
  ];
  return (
    <Row gap={16} wrap>
      {items.map((it) => (
        <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: pinColor(it.st),
              display: "inline-block",
            }}
          />
          <Text size="small" weight="medium">
            {it.name}
          </Text>
          <Text size="small" tone="tertiary">
            {pinLabel(it.st)}
          </Text>
        </div>
      ))}
    </Row>
  );
}

function AnnoList({ phase }: { phase: Phase }) {
  return (
    <Stack gap={0}>
      {CONTACTS.map((p, i) => {
        const st = phase.pins[p.key] || "off";
        return (
          <div
            key={p.key}
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 0",
              borderBottom: i === CONTACTS.length - 1 ? "none" : `1px solid ${C.stageLine}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                marginTop: 6,
                background: pinColor(st),
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.key}</span>
                <span style={{ fontSize: 12, color: pinColor(st) }}>{pinLabel(st)}</span>
              </div>
              <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{p.role}</div>
            </div>
          </div>
        );
      })}
    </Stack>
  );
}

function ProcessPane() {
  const [step, setStep] = useCanvasState("demoStep", 0);
  const [playing, setPlaying] = useCanvasState("demoPlaying", false);
  const idx = Math.max(0, Math.min(step, PHASES.length - 1));
  const phase = PHASES[idx];
  const okCount = PIN_ORDER.filter((k) => phase.pins[k] === "ok").length;

  const go = (n: number) => setStep(Math.max(0, Math.min(n, PHASES.length - 1)));
  const stopPlay = () => {
    demoPlayToken += 1;
    setPlaying(false);
  };
  const playAll = () => {
    const token = ++demoPlayToken;
    setPlaying(true);
    setStep(0);
    let i = 0;
    const tick = () => {
      if (token !== demoPlayToken) return;
      i += 1;
      if (i >= PHASES.length) {
        setPlaying(false);
        return;
      }
      setStep(i);
      setTimeout(tick, i === PHASES.length - 1 ? 1600 : 1100);
    };
    setTimeout(tick, 900);
  };

  return (
    <Stack gap={14}>
      {/* SHOT 旁白 */}
      <div
        style={{
          background: C.stage,
          border: `1px solid ${C.stageLine}`,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: C.gold,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            marginBottom: 6,
          }}
        >
          SHOT {phase.ep}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
          {phase.title}
        </div>
        <div style={{ fontSize: 14, color: C.hud, lineHeight: 1.55 }}>{phase.narration}</div>
        <div style={{ fontSize: 12, color: C.mute, marginTop: 8 }}>{phase.car}</div>
      </div>

      {/* 主舞台 */}
      <Stage phase={phase} />

      <Row gap={8} align="center" justify="space-between" wrap>
        <Row gap={8} wrap>
          <Button variant="primary" onClick={playAll} disabled={playing}>
            {playing ? "播放中…" : "开始展示"}
          </Button>
          <Button variant="secondary" onClick={stopPlay} disabled={!playing}>
            停止
          </Button>
          <Button variant="ghost" disabled={idx <= 0 || playing} onClick={() => go(idx - 1)}>
            上一步
          </Button>
          <Button
            variant="ghost"
            disabled={idx >= PHASES.length - 1 || playing}
            onClick={() => go(idx + 1)}
          >
            下一步
          </Button>
        </Row>
        <span
          style={{
            fontSize: 12,
            color: C.gold,
            background: C.chip,
            padding: "6px 10px",
            letterSpacing: 0.5,
          }}
        >
          {idx + 1}/{PHASES.length} · 已通 {okCount}/9
        </span>
      </Row>

      <PinChips phase={phase} />
      <LockRow phase={phase} />

      <Grid columns="1.4fr 0.9fr" gap={16}>
        <div
          style={{
            background: C.stage,
            border: `1px solid ${C.stageLine}`,
            padding: "4px 14px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              color: C.gold,
              paddingTop: 12,
              marginBottom: 4,
            }}
          >
            触头通路
          </div>
          <AnnoList phase={phase} />
        </div>
        <div
          style={{
            background: C.stage,
            border: `1px solid ${C.stageLine}`,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              color: C.gold,
              marginBottom: 10,
            }}
          >
            端面布置 · φ{FACE_OD}
          </div>
          <FaceMini phase={phase} />
          <div style={{ fontSize: 11, color: C.mute, marginTop: 8, textAlign: "center" }}>
            PE 原点 · +Y 锁止 · 9 触头
          </div>
        </div>
      </Grid>

      {/* 胶片条：只留编号，避免按钮墙 */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {PHASES.map((p, i) => {
          const active = i === idx;
          return (
            <button
              key={p.key}
              type="button"
              disabled={playing}
              onClick={() => go(i)}
              title={`${p.ep} ${p.title}`}
              style={{
                minWidth: 36,
                height: 28,
                padding: "0 8px",
                border: `1px solid ${active ? C.gold : C.stageLine}`,
                background: active ? C.chip : "transparent",
                color: active ? C.gold : C.mute,
                fontSize: 11,
                letterSpacing: 0.5,
                cursor: playing ? "default" : "pointer",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            >
              {p.ep}
            </button>
          );
        })}
      </div>
    </Stack>
  );
}

function ContainFrame(props: { src: string; w: number; h: number; maxH?: number; alt: string }) {
  const t = useHostTheme();
  const maxH = props.maxH ?? 420;
  const aspect = props.w / Math.max(1, props.h);
  return (
    <div
      style={{
        width: "100%",
        maxHeight: maxH,
        aspectRatio: String(aspect),
        background: C.stage,
        border: `1px solid ${C.stageLine}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img
        src={props.src}
        alt={props.alt}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

function StandardPane() {
  return (
    <Stack gap={16}>
      <Text tone="secondary" size="small">
        官方扫描图完整等比显示（object-fit: contain），不裁切、不拉伸。
      </Text>
      <Grid columns={2} gap={14}>
        <Stack gap={8}>
          <Text weight="semibold">图 A.1 · 触头布置</Text>
          <ContainFrame src={IMG.a1} w={A1_W} h={A1_H} maxH={460} alt="图A.1" />
        </Stack>
        <Stack gap={8}>
          <Text weight="semibold">图 9 · 空间尺寸</Text>
          <ContainFrame src={IMG.fig9} w={FIG9_W} h={FIG9_H} maxH={460} alt="图9" />
        </Stack>
      </Grid>
    </Stack>
  );
}

function CoordsPane() {
  return (
    <Stack gap={12}>
      <Text size="small" tone="secondary">
        PE 原点 · +Y 锁止 · mm · 插座为插头 X 镜像 · 端面 φ{FACE_OD}
      </Text>
      <Table
        headers={["No", "触头", "X", "Y", "孔φ", "针φ", "角色"]}
        rows={CONTACTS.map((p) => [
          String(p.no),
          p.key,
          String(p.x),
          String(p.y),
          String(p.hole),
          String(p.pin),
          p.role,
        ])}
      />
    </Stack>
  );
}

export default function ConnectProcessDemo() {
  const t = useHostTheme();
  const [tab, setTab] = useCanvasState<TabKey>("demoTab", "process");

  return (
    <div style={{ background: t.bg.editor, minHeight: "100%" }}>
      <Stack gap={14} style={{ padding: "16px 16px 28px", maxWidth: 920 }}>
        <Row gap={12} align="end" justify="space-between" wrap>
          <Stack gap={4}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: C.gold,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            >
              GB/T 20234.3 · DC 9-PIN
            </div>
            <H1>半剖透明 · 连接诊断</H1>
          </Stack>
          <Row gap={6}>
            {(
              [
                ["process", "产品片"],
                ["standard", "国标原图"],
                ["coords", "孔位"],
              ] as [TabKey, string][]
            ).map(([k, label]) => (
              <span key={k}>
                <Pill active={tab === k} onClick={() => setTab(k)}>
                  {label}
                </Pill>
              </span>
            ))}
          </Row>
        </Row>

        <Divider />

        {tab === "process" ? <ProcessPane /> : null}
        {tab === "standard" ? <StandardPane /> : null}
        {tab === "coords" ? <CoordsPane /> : null}
      </Stack>
    </div>
  );
}
'''


def b64_jpeg(src: Path, max_w: int, quality: int = 78) -> tuple[str, int, int]:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w > max_w:
        nh = int(h * max_w / w)
        im = im.resize((max_w, nh), Image.Resampling.LANCZOS)
        w, h = im.size
    bio = io.BytesIO()
    im.save(bio, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(bio.getvalue()).decode("ascii"), w, h


def main() -> None:
    idle, _, _ = b64_jpeg(ASSETS / "cutaway_demo_idle.jpg", 720, 76)
    seated, _, _ = b64_jpeg(ASSETS / "cutaway_demo_seated.jpg", 720, 76)
    ok, _, _ = b64_jpeg(ASSETS / "cutaway_demo_ok.jpg", 720, 76)
    charging, _, _ = b64_jpeg(ASSETS / "cutaway_demo_charging.jpg", 720, 76)
    fail, _, _ = b64_jpeg(ASSETS / "cutaway_demo_cc2_fail.jpg", 720, 76)
    a1, a1w, a1h = b64_jpeg(ASSETS / "demo_gb_dc_figA1.jpg", 640, 78)
    fig9, f9w, f9h = b64_jpeg(ASSETS / "demo_gb_dc_fig9.jpg", 640, 80)

    tsx = (
        TEMPLATE.replace("__IMG_IDLE__", idle)
        .replace("__IMG_SEATED__", seated)
        .replace("__IMG_OK__", ok)
        .replace("__IMG_CHARGING__", charging)
        .replace("__IMG_FAIL__", fail)
        .replace("__IMG_A1__", a1)
        .replace("__IMG_FIG9__", fig9)
        .replace("__A1_W__", str(a1w))
        .replace("__A1_H__", str(a1h))
        .replace("__FIG9_W__", str(f9w))
        .replace("__FIG9_H__", str(f9h))
    )
    assert "gap={14}" in tsx
    OUT.write_text(tsx, encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
