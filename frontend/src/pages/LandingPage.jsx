import { useNavigate } from "react-router-dom"
import { BellRing, BookOpen, Clock3, Crosshair, HeartPulse, MapPin, ShieldCheck, UserRound, UsersRound } from "lucide-react"
import routePreview from "../assets/emergency-route-preview.png"
import logo from "../assets/logo.svg"
import {
  REGISTER_ROUTE,
  LOGIN_ROUTE
} from "../constants/routes.js"

const features = [
  { title: "Real-time Match", text: "We find the nearest eligible responder instantly.", Icon: Crosshair },
  { title: "Live Location", text: "Track responder location in real time.", Icon: MapPin },
  { title: "Secure & Reliable", text: "Your safety and privacy are our priority.", Icon: ShieldCheck }
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <main className="sahayog-hero">
      <section className="hero-content">
        <div className="hero-copy">
          <div className="hero-eyebrow"><HeartPulse size={16} fill="currentColor" /> Real-time. Reliable. Right on Time.</div>
          <h1>When Every<br />Second Counts,<br /><span>We&apos;re Here to Help.</span></h1>
          <p className="hero-description">Sahayog connects emergencies to nearby responders in real time. Report. Respond. Resolve. Together, we save more lives.</p>

          <div className="hero-features">
            {features.map(({ title, text, Icon }) => (
              <div className="hero-feature" key={title}>
                <div className="feature-icon"><Icon size={20} /></div>
                <div><strong>{title}</strong><span>{text}</span></div>
              </div>
            ))}
          </div>

          <div className="hero-actions">
            <button className="hero-primary" type="button" onClick={() => navigate(REGISTER_ROUTE)}>Report Emergency <BellRing size={18} /></button>
            <button className="hero-secondary" type="button" onClick={() => navigate(REGISTER_ROUTE)}>I&apos;m a Responder <UserRound size={18} /></button>
          </div>
        </div>

        <div className="phone-stage" aria-label="Sahayog emergency dispatch preview">
          <div className="phone-shell">
            <span className="phone-button phone-volume-up" aria-hidden="true" />
            <span className="phone-button phone-volume-down" aria-hidden="true" />
            <span className="phone-button phone-power" aria-hidden="true" />
            <div className="phone-island" />
            <div className="phone-screen">
              <div className="phone-status"><span>9:41</span><span>● ● ●</span></div>
              <div className="phone-route-alert"><div className="route-alert-icon"><BellRing size={17} /></div><div><strong>Emergency Reported</strong><span>We are finding a nearby responder...</span></div><b>LIVE</b></div>
              <div className="route-image-frame"><img className="phone-route-preview" src={routePreview} alt="Emergency route to a nearby responder" /></div>
              <div className="responder-card"><small>Nearby Responder Found</small><div className="responder-row"><div className="avatar">A</div><div><strong>Arjun Thapa <span>●</span></strong><p>2.4 km away</p></div></div><div className="emergency-type"><HeartPulse size={15} /> <span>Emergency Offer<br /><b>Medical Assistance</b></span></div><div className="phone-actions"><button>Accept</button><button>Decline</button></div></div>
              <div className="tracking-card"><strong>Live Tracking</strong><span>Your responder is on the way.</span><div className="tracking-line"><i /><i /><i /><i /></div><div className="tracking-labels"><span>Reported</span><span>Dispatched</span><span>On the Way</span><span>Completed</span></div></div>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-it-works-section">
        <p>HOW SAHAYOG WORKS</p>
        <h2>Three taps. Three minutes. Help arrives.</h2>
        <div className="how-it-works-grid">
          <article className="how-step"><span className="step-number"></span><div className="how-icon"><BellRing size={23} /></div><h3>Tap to report</h3><p>Choose your emergency type or describe the situation. Your location is shared securely.</p></article>
          <article className="how-step"><span className="step-number"></span><div className="how-icon"><MapPin size={23} /></div><h3>Nearest responder dispatched</h3><p>Our dispatch matches you with verified responders closest to your location.</p></article>
          <article className="how-step"><span className="step-number"></span><div className="how-icon"><Clock3 size={23} /></div><h3>Track help in real time</h3><p>Watch your responder approach on the map. Live ETA updates every 10 seconds.</p></article>
        </div>
      </section>
      <section id="features" className="features-section">
        <div className="features-copy"><p>BUILT FOR REAL EMERGENCIES</p><h2>More than a panic button.</h2><span>Sahayog gives citizens, responders, and dispatchers a shared picture of every incident — so no one is left waiting, guessing, or alone.</span></div>
        <div className="features-grid">
          <article><div><MapPin size={20} /></div><h3>Live location sharing</h3><p>Encrypted, precise GPS pings so responders find you — even when you can&apos;t describe where you are.</p></article>
          <article><div><BookOpen size={20} /></div><h3>First-aid guides</h3><p>Offline-ready step-by-step guides for CPR, choking, burns, and seizures while help is en route.</p></article>
          <article><div><UsersRound size={20} /></div><h3>Emergency contacts</h3><p>Auto-notify family with your status, incident ID, and live tracking link when you report.</p></article>
          <article><div><ShieldCheck size={20} /></div><h3>Verified responders</h3><p>Every responder is background-checked, trained, and rated by the communities they serve.</p></article>
        </div>
      </section>
      <section id="responders" className="responder-section">
        <div className="responder-copy"><p>JOIN THE NETWORK</p><h2>Are you a paramedic, firefighter, or first responder?</h2><span>Sahayog is powered by 1,200+ verified responders across Nepal. Register your team, receive nearby dispatches, and coordinate faster with live-tracked incidents.</span><div><button type="button" onClick={() => navigate(REGISTER_ROUTE)}>Register your team <b>→</b></button><button type="button" onClick={() => navigate(REGISTER_ROUTE)}>Partner with us</button></div></div>
        <div className="responder-stats"><article><strong>420+</strong><span>Ambulance</span></article><article><strong>180+</strong><span>Fire crews</span></article><article><strong>310+</strong><span>Community patrols</span></article><article><strong>290+</strong><span>Rescue volunteers</span></article></div>
      </section>
      <footer className="landing-footer">
        <div className="footer-main"><div className="footer-brand"><img src={logo} alt="Sahayog" /><p>Nepal&apos;s community emergency response network.<br />Faster help, closer to home.</p></div><div><h3>Product</h3><a href="#how-it-works">Report emergency</a><a href="#features">First aid guides</a><a href="#responders">Responder app</a></div><div><h3>Company</h3><a href="#how-it-works">About</a><a href="#responders">Partners</a></div></div>
        <div className="footer-bottom"><span>© 2026 Sahayog. Made with care in Nepal.</span><span><i /> Dispatch center online</span></div>
      </footer>
    </main>
  )
}
