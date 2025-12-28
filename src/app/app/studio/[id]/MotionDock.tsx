"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions
} from "framer-motion";

type DockContextType = {
  mouseY: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

const DockContext = React.createContext<DockContextType | undefined>(undefined);

function useDock() {
  const ctx = React.useContext(DockContext);
  if (!ctx) throw new Error("useDock must be used within Dock");
  return ctx;
}

const DEFAULT_SPRING: SpringOptions = { mass: 0.12, stiffness: 180, damping: 14 };
const DEFAULT_PANEL_WIDTH = 52;

export function MotionDock({
  children,
  className,
  magnification = 78,
  distance = 150,
  spring = DEFAULT_SPRING,
  panelWidth = DEFAULT_PANEL_WIDTH
}: {
  children: React.ReactNode;
  className?: string;
  magnification?: number;
  distance?: number;
  spring?: SpringOptions;
  panelWidth?: number;
}) {
  const mouseY = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxWidth = React.useMemo(() => {
    return Math.max(panelWidth, magnification + magnification / 2 + 4);
  }, [magnification, panelWidth]);

  const widthRow = useTransform(isHovered, [0, 1], [panelWidth, maxWidth]);
  const width = useSpring(widthRow, spring);

  return (
    <motion.div
      style={{ width }}
      onMouseMove={({ clientY }) => {
        isHovered.set(1);
        mouseY.set(clientY);
      }}
      onMouseLeave={() => {
        isHovered.set(0);
        mouseY.set(Infinity);
      }}
      className="flex items-center justify-center overflow-visible"
      role="toolbar"
      aria-label="Dock"
    >
      <motion.div
        style={{ width: panelWidth }}
        className={[
          "flex w-fit flex-col items-center gap-2 rounded-2xl border border-border bg-white p-2 shadow-md",
          className ?? ""
        ].join(" ")}
      >
        <DockContext.Provider value={{ mouseY, spring, magnification, distance }}>
          {children}
        </DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

export function MotionDockItem({
  active,
  label,
  onClick,
  children
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const { distance, magnification, mouseY, spring } = useDock();
  const [isVisible, setIsVisible] = React.useState(false);

  const mouseDistance = useTransform(mouseY, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 };
    return val - domRect.y - domRect.height / 2;
  });

  const sizeTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [40, magnification, 40]
  );

  const size = useSpring(sizeTransform, spring);
  const iconSize = useTransform(size, (v) => v / 2);

  return (
    <motion.button
      ref={ref}
      type="button"
      style={{ width: size, height: size }}
      onClick={onClick}
      onHoverStart={() => setIsVisible(true)}
      onHoverEnd={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      className={[
        "relative inline-flex items-center justify-center rounded-xl transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      ].join(" ")}
      aria-label={label}
    >
      <motion.div
        style={{ width: iconSize, height: iconSize }}
        className="flex items-center justify-center"
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {isVisible ? (
          <motion.div
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: 10 }}
            exit={{ opacity: 0, x: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border bg-white/95 px-2 py-1 text-xs text-foreground shadow-sm"
            role="tooltip"
          >
            {label}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
