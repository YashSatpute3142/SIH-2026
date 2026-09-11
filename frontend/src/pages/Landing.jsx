import { useState, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Drop the three provided images into src/assets/ with these exact names,
// or update the paths below to match wherever you keep them.
const heroImage = "/assets/mine-hero-blue-coal.jpg";
const minerImage = "/assets/miner-double-exposure.jpg";
const tunnelImage = "/assets/mine-tunnel-cart.jpg";

/* ------------------------------------------------------------------ */
/*  Design tokens (kept local so this file drops into any project)     */
/* ------------------------------------------------------------------ */
const ink = "#05080D";
const panel = "#0A1622";
const glow = "#4FB6FF";
const glowDim = "#1E4A6B";
const danger = "#7A2323";

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const scrollToId = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="relative w-full font-inter text-[#EAF0F6]"
      style={{ backgroundColor: ink }}
    >
      <Navbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onAbout={() => scrollToId("below-surface")}
        onLogin={() => goTo("/login")}
        onRegister={() => goTo("/register")}
      />

      <div className="relative w-full">
        <div className="sticky top-0 z-10 h-screen">
          <Hero onExplore={() => goTo("/login")} />
        </div>

        <div className="sticky top-0 z-20 h-screen">
          <BelowTheSurface />
        </div>

        <div className="sticky top-0 z-30 h-screen">
          <FromGroundToSystem onEnter={() => goTo("/login")} />
        </div>
      </div>

      <Footer onLogin={() => goTo("/login")} onRegister={() => goTo("/register")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                              */
/* ------------------------------------------------------------------ */
function Navbar({ menuOpen, setMenuOpen, onAbout, onLogin, onRegister }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex items-center justify-between px-6 py-6 md:px-12 lg:px-16">
        <div className="flex items-center gap-3">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: glow, boxShadow: `0 0 10px ${glow}` }}
          />
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#EAF0F6]">
            Mine Subsidence System
          </span>
        </div>

        <nav className="hidden items-center gap-10 md:flex">
          <button
            onClick={onAbout}
            className="text-[13px] uppercase tracking-[0.14em] text-[#B7C4D1] transition-colors hover:text-white"
          >
            About
          </button>
          <button
            onClick={onLogin}
            className="text-[13px] uppercase tracking-[0.14em] text-[#B7C4D1] transition-colors hover:text-white"
          >
            Login
          </button>
          <button
            onClick={onRegister}
            className="rounded-sm border px-5 py-2 text-[13px] uppercase tracking-[0.14em] transition-colors hover:bg-[#4FB6FF] hover:text-[#05080D]"
            style={{ borderColor: glowDim, color: glow }}
          >
            Register
          </button>
        </nav>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex flex-col gap-[5px] md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className="h-px w-6 bg-[#EAF0F6] transition-transform"
            style={menuOpen ? { transform: "translateY(6px) rotate(45deg)" } : undefined}
          />
          <span
            className="h-px w-6 bg-[#EAF0F6] transition-opacity"
            style={menuOpen ? { opacity: 0 } : undefined}
          />
          <span
            className="h-px w-6 bg-[#EAF0F6] transition-transform"
            style={menuOpen ? { transform: "translateY(-6px) rotate(-45deg)" } : undefined}
          />
        </button>
      </div>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-col gap-1 border-t border-white/10 bg-[#05080D]/95 px-6 py-5 backdrop-blur-xl md:hidden"
        >
          <button
            onClick={onAbout}
            className="py-3 text-left text-sm uppercase tracking-[0.14em] text-[#B7C4D1]"
          >
            About
          </button>
          <button
            onClick={onLogin}
            className="py-3 text-left text-sm uppercase tracking-[0.14em] text-[#B7C4D1]"
          >
            Login
          </button>
          <button
            onClick={onRegister}
            className="py-3 text-left text-sm uppercase tracking-[0.14em]"
            style={{ color: glow }}
          >
            Register
          </button>
        </motion.div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 1 — The Mine (Hero)                                        */
/* ------------------------------------------------------------------ */
function Hero({ onExplore }) {

  return (
    <section
      id="the-mine"
      className="relative flex h-[100vh] min-h-[640px] w-full items-center justify-center overflow-hidden"
    >
      <div
        style={{ backgroundImage: `url(${heroImage})` }}
        className="absolute -top-[8%] inset-x-0 z-0 h-[116%] w-full scale-100 bg-cover bg-center"
      />

      {/* Readability gradient — layered, not flattening */}
      <div
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,8,13,0.55) 0%, rgba(5,8,13,0.15) 30%, rgba(5,8,13,0.35) 60%, rgba(5,8,13,0.92) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,8,13,0.55) 0%, rgba(5,8,13,0) 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(5,8,13,0.18) 0%, rgba(5,8,13,0) 52%)",
        }}
      />

      <motion.div
        className="relative z-10 flex w-full justify-center px-6 md:px-12 lg:px-16"
      >
        <div className="max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mb-6 flex items-center justify-center gap-3 border-l-2 pl-3"
            style={{ borderColor: glow }}
          >
            <span className="text-[12px] uppercase tracking-[0.24em] text-[#9FC6E6]">
              Intelligent Mine Safety
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
            className="font-[Oswald,sans-serif] text-[15vw] font-semibold uppercase leading-[0.86] tracking-[-0.01em] text-white sm:text-[9vw] md:text-[7.5vw] lg:text-[6.2vw]"
          >
            Mine
            <br />
            <span style={{ color: glow, textShadow: `0 0 40px ${glowDim}` }}>
              Subsidence
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="mt-7 max-w-md text-[15px] uppercase tracking-[0.1em] text-[#B7C4D1] md:text-base"
          >
            AI-Enabled Monitoring &amp; Early Warning
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-3 text-sm text-[#8CA0B3]"
          >
            Detect. Analyze. Assess. Respond.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-10"
          >
            <button
              onClick={onExplore}
              className="group inline-flex items-center gap-4 border px-7 py-4 text-[13px] font-medium uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#4FB6FF] hover:text-[#05080D]"
              style={{ borderColor: glow }}
            >
              Explore the System
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-10 w-px"
          style={{ background: `linear-gradient(180deg, ${glow}, transparent)` }}
        />
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2 — Below the Surface                                      */
/* ------------------------------------------------------------------ */
function BelowTheSurface() {
  return (
    <section
      id="below-surface"
      className="relative flex h-screen w-full items-center overflow-hidden py-24 md:py-32 lg:py-40"
      style={{ backgroundColor: panel }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 md:px-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="order-2 lg:order-1"
        >
          <div className="mb-6 flex items-center gap-3 border-l-2 pl-3" style={{ borderColor: danger }}>
            <span className="text-[12px] uppercase tracking-[0.24em] text-[#C99]">
              Below the Surface
            </span>
          </div>

          <h2 className="font-[Oswald,sans-serif] text-4xl font-semibold uppercase leading-[0.95] text-white md:text-5xl">
            The People
            <br />
            Behind the Mine
          </h2>

          <p className="mt-7 max-w-md text-[15px] leading-7 text-[#B7C4D1]">
            Mining operates in complex underground environments where ground
            stability matters. Changes beneath the surface can develop
            gradually, and unnoticed movement can become a real safety
            concern.
          </p>

          <p className="mt-4 max-w-md text-[15px] leading-7 text-[#B7C4D1]">
            Early awareness gives people time to act. Technology doesn't
            replace judgment underground — it supports safer decisions above
            it.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="relative order-1 aspect-[4/5] w-full overflow-hidden lg:order-2 lg:aspect-[3/4]"
        >
          <motion.div
            style={{
              backgroundImage: `url(${minerImage})`,
              filter: "grayscale(1) contrast(1.1) brightness(0.85)",
            }}
            className="absolute inset-0 -top-[8%] h-[116%] w-full scale-105 bg-cover bg-top"
          />
          {/* Re-tint the warm double-exposure into the site's cold palette */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-color"
            style={{ backgroundColor: "#2E6FA6" }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,22,34,0.15) 0%, rgba(10,22,34,0.55) 100%), linear-gradient(90deg, rgba(10,22,34,0.5) 0%, rgba(10,22,34,0) 35%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 border"
            style={{ borderColor: "rgba(79,182,255,0.15)" }}
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3 — From the Ground to the System                          */
/* ------------------------------------------------------------------ */
const FLOW_STEPS = [
  {
    label: "Sensors",
    desc: "Collect environmental and structural observations.",
    Icon: SensorIcon,
  },
  {
    label: "Communication",
    desc: "Transmit information from monitoring nodes.",
    Icon: SignalIcon,
  },
  {
    label: "AI Analysis",
    desc: "Identify unusual patterns and behaviour.",
    Icon: CpuIcon,
  },
  {
    label: "Risk Assessment",
    desc: "Evaluate potential subsidence conditions.",
    Icon: GaugeIcon,
  },
  {
    label: "Early Warning",
    desc: "Support timely safety decisions.",
    Icon: AlertIcon,
  },
];

function FromGroundToSystem({ onEnter }) {
  return (
    <section id="system" className="relative flex h-screen w-full items-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${tunnelImage})` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,8,13,0.92) 0%, rgba(5,8,13,0.78) 20%, rgba(5,8,13,0.82) 65%, rgba(5,8,13,0.97) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-32 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="mb-6 flex items-center gap-3 border-l-2 pl-3"
          style={{ borderColor: glow }}
        >
          <span className="text-[12px] uppercase tracking-[0.24em] text-[#9FC6E6]">
            From the Ground to the System
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="max-w-2xl font-[Oswald,sans-serif] text-4xl font-semibold uppercase leading-[0.95] text-white md:text-5xl"
        >
          What happens between the rock and the alert
        </motion.h2>

        <FlowDiagram />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 flex justify-center md:justify-start"
        >
          <button
            onClick={onEnter}
            className="group inline-flex items-center gap-4 px-8 py-4 text-[13px] font-medium uppercase tracking-[0.16em] text-[#05080D] transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: glow }}
          >
            Enter the System
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}

function FlowDiagram() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.75", "start 0.25"],
  });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative mt-20">
      {/* Connecting line — desktop (horizontal) */}
      <svg
        className="pointer-events-none absolute left-0 top-[26px] hidden w-full md:block"
        height="2"
        viewBox="0 0 1000 2"
        preserveAspectRatio="none"
      >
        <line x1="60" y1="1" x2="940" y2="1" stroke={glowDim} strokeWidth="1" />
        <motion.line
          x1="60"
          y1="1"
          x2="940"
          y2="1"
          stroke={glow}
          strokeWidth="1.5"
          style={{ pathLength }}
        />
      </svg>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-5 md:gap-6">
        {FLOW_STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="relative flex flex-col items-start md:items-center md:text-center"
          >
            <div
              className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-[#05080D]"
              style={{ borderColor: glowDim }}
            >
              <step.Icon />
            </div>
            <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-white">
              {step.label}
            </p>
            <p className="mt-2 max-w-[160px] text-[13px] leading-5 text-[#8CA0B3]">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Minimal line icons (no external icon dependency)                   */
/* ------------------------------------------------------------------ */
function iconProps() {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: glow,
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}

function SensorIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 19v-4M10 19v-8M15 19V7M20 19V4" />
    </svg>
  );
}
function CpuIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-5" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg {...iconProps()} stroke="#C97A7A">
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="#C97A7A" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                              */
/* ------------------------------------------------------------------ */
function Footer({ onLogin, onRegister }) {
  return (
    <footer
      className="w-full border-t border-white/10 px-6 py-10 md:px-12 lg:px-16"
      style={{ backgroundColor: ink }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white">
            Mine Subsidence System
          </p>
          <p className="mt-1 text-[13px] text-[#8CA0B3]">
            AI-Enabled Smart Mine Subsidence Monitoring &amp; Early Warning
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={onLogin}
            className="text-[13px] uppercase tracking-[0.14em] text-[#B7C4D1] hover:text-white"
          >
            Login
          </button>
          <button
            onClick={onRegister}
            className="text-[13px] uppercase tracking-[0.14em] text-[#B7C4D1] hover:text-white"
          >
            Register
          </button>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-6xl text-[11px] tracking-[0.08em] text-[#5A6B7C]">
        © 2026 Mine Subsidence System
      </p>
    </footer>
  );
}

export default Landing;
