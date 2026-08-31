import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Landing() {
  const navigate = useNavigate();

  function handleDirectSignIn() {
    window.location.href = `${API_BASE_URL}/api/auth/google/login`;
  }

  function goToLoginPage() {
    navigate("/login");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-inter text-slate-100">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="fixed inset-0 z-0 h-full w-full object-cover"
      >
        <source src="/mine-background.mp4" type="video/mp4" />
      </video>

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="flex items-center justify-between px-6 py-5 md:px-12 lg:px-16">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk-red opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-risk-red" />
            </span>

            <div>
              <p className="font-display text-sm font-semibold tracking-[0.08em] text-white">
                MINE SUBSIDENCE SYSTEM
              </p>
              <p className="mt-1 font-mono-ui text-[9px] tracking-[0.2em] text-slate-400">
                INTELLIGENT MONITORING PLATFORM
              </p>
            </div>
          </div>

          <button
            onClick={goToLoginPage}
            className="rounded-xl border border-white/15 bg-black/30 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/10"
          >
            Sign In
          </button>
        </nav>

        <main className="flex flex-1 items-center px-6 pb-10 pt-8 md:px-12 lg:px-16">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="relative">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/25 px-4 py-2 backdrop-blur-xl"
              >
                <span className="h-2 w-2 rounded-full bg-risk-red" />

                
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="font-display max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white drop-shadow-2xl md:text-6xl lg:text-7xl"
              >
                AI-Enabled Smart
                <br />
                Mine{" "}
                <span className="font-pinyon text-red-500 text-[1.3em]">Subsidence</span>
                <br />
                Monitoring
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="mt-8 max-w-xl text-base leading-8 text-slate-200 drop-shadow-lg md:text-lg"
              >
                Real-time early warning for surface subsidence above
                underground coal-mine panels — decision-support only, never a
                replacement for authorized mine safety procedure.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-9"
              >
                <button
                  onClick={handleDirectSignIn}
                  className="group inline-flex items-center gap-4 rounded-xl bg-risk-red px-7 py-4 font-semibold text-navy-950 transition-all hover:scale-[1.02] hover:shadow-2xl"
                >
                  Sign In with Google
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </motion.div>
            </section>

            <section className="relative hidden min-h-[500px] lg:block">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 60,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
              />

              <motion.div
                animate={{ rotate: -360 }}
                transition={{
                  duration: 45,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-risk-red/20"
              />

              <div className="absolute left-[22%] top-[25%] h-px w-[28%] rotate-[22deg] bg-gradient-to-r from-transparent via-risk-red/70 to-transparent" />
              <div className="absolute left-[48%] top-[34%] h-px w-[27%] -rotate-[20deg] bg-gradient-to-r from-transparent via-risk-red/70 to-transparent" />
              <div className="absolute left-[30%] top-[60%] h-px w-[35%] -rotate-[10deg] bg-gradient-to-r from-transparent via-risk-red/70 to-transparent" />
              <div className="absolute left-[49%] top-[48%] h-[24%] w-px bg-gradient-to-b from-transparent via-risk-red/60 to-transparent" />

              <SensorNode
                label="NODE-01"
                value="STABLE"
                className="left-[8%] top-[18%]"
                delay={0}
              />

              <SensorNode
                label="NODE-02"
                value="ACTIVE"
                className="right-[5%] top-[28%]"
                delay={0.4}
              />

              <SensorNode
                label="NODE-03"
                value="MONITORING"
                className="bottom-[18%] left-[16%]"
                delay={0.8}
              />

              <motion.div
                animate={{
                  y: [0, -10, 0],
                  scale: [1, 1.03, 1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-risk-red/50 bg-black/35 backdrop-blur-xl"
              >
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-risk-red/30 bg-risk-red/10">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-3 w-3 rounded-full bg-risk-red shadow-[0_0_25px_currentColor]" />

                    <p className="font-mono-ui text-xs tracking-[0.2em] text-white">
                      AI CORE
                    </p>

                    <p className="mt-1 font-mono-ui text-[8px] tracking-[0.15em] text-risk-red">
                      ANALYZING
                    </p>
                  </div>
                </div>
              </motion.div>

              <div className="absolute bottom-4 right-4 border-l border-white/20 pl-4">
                <p className="font-mono-ui text-[9px] tracking-[0.2em] text-slate-400">
                  SURFACE MESH NETWORK
                </p>
                <p className="mt-2 font-display text-sm text-white">
                  Sense → Analyze → Predict
                </p>
              </div>
            </section>
          </div>
        </main>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 pb-10 md:grid-cols-3 md:px-12 lg:px-16"
        >
          <FeatureCard
            number="01"
            title="Hybrid Sensor Network"
            description="Real ESP32 nodes and simulated nodes, treated identically across every feature."
          />

          <FeatureCard
            number="02"
            title="AI Risk Classification"
            description="Isolation Forest, XGBoost classification, and displacement forecasting."
          />

          <FeatureCard
            number="03"
            title="Offline-First"
            description="Local alerts continue working even when cloud connectivity is lost."
          />
        </motion.div>

        <footer className="px-6 pb-6 text-center font-mono-ui text-[10px] tracking-[0.12em] text-slate-500">
          PROTOTYPE SYSTEM · NOT A SUBSTITUTE FOR STATUTORY MINE-SAFETY
          PROCEDURES
        </footer>
      </div>
    </div>
  );
}

function SensorNode({ label, value, className, delay }) {
  return (
    <motion.div
      animate={{
        y: [0, -8, 0],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`absolute ${className}`}
    >
      <div className="rounded-xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-risk-red" />
          <span className="font-mono-ui text-[9px] tracking-[0.15em] text-white">
            {label}
          </span>
        </div>

        <p className="mt-2 font-mono-ui text-[8px] tracking-[0.12em] text-slate-400">
          {value}
        </p>
      </div>
    </motion.div>
  );
}

function FeatureCard({ number, title, description }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="group rounded-2xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl transition-colors hover:border-risk-red/40"
    >
      <span className="font-mono-ui text-xs tracking-[0.15em] text-risk-red">
        {number}
      </span>

      <h3 className="mt-5 font-display text-xl font-medium text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {description}
      </p>

      <div className="mt-6 h-px w-full bg-gradient-to-r from-risk-red/50 to-transparent" />
    </motion.div>
  );
}

export default Landing;