import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  X,
  Minus,
  Globe,
  Briefcase,
  BarChart3,
  Shield,
  Target,
  FileText,
  Bot,
} from 'lucide-react';

export default function Index() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
  }, []);

  return (
    <div className="bg-brand-bg text-gray-900" style={{ backgroundColor: '#FAFBFF' }}>
      {/* NAVIGATION */}
      <nav
        className="sticky top-0 z-50 h-15"
        style={{
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(250, 251, 255, 0.92)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          height: '60px',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.01em' }}>
            i<span style={{ color: '#00B8A9' }}>Career</span>
            <span style={{ color: '#0A1628' }}>OS</span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex gap-8">
            <a href="#" className="text-sm font-medium hover:text-brand-teal transition">
              Platform
            </a>
            <a href="#" className="text-sm font-medium hover:text-brand-teal transition">
              Features
            </a>
            <a href="#" className="text-sm font-medium hover:text-brand-teal transition">
              Pricing
            </a>
            <a href="#" className="text-sm font-medium hover:text-brand-teal transition">
              About
            </a>
          </div>

          {/* Right Buttons */}
          <div className="flex gap-3">
            <Link
              to="/auth/login"
              className="px-5 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition"
              style={{
                backgroundColor: 'white',
                color: '#0A1628',
                borderColor: 'rgba(0, 0, 0, 0.07)',
              }}
            >
              Sign in
            </Link>
            <Link
              to="/auth/signup"
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition"
              style={{
                backgroundColor: '#00B8A9',
                boxShadow: '0 2px 10px rgba(0, 184, 169, 0.3)',
                padding: '9px 18px',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a598')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B8A9')}
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* SECTION 1: HERO */}
      <section
        style={{
          backgroundImage: 'linear-gradient(175deg, #f0fdf9 0%, #fafbff 60%, #fafbff 100%)',
          paddingTop: '80px',
          paddingBottom: '80px',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div>
              {/* Eyebrow Chip */}
              <div
                className="inline-block mb-6 px-3 py-1 rounded-full text-center"
                style={{
                  backgroundColor: 'rgba(0, 184, 169, 0.1)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#00B8A9',
                }}
              >
                Career Operating System
              </div>

              {/* H1 */}
              <h1
                className="mb-6 font-bold"
                style={{
                  fontSize: '52px',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: '#0A1628',
                }}
              >
                Run your entire career on{' '}
                <span style={{ color: '#00B8A9' }}>autopilot.</span>
              </h1>

              {/* Body Text */}
              <p
                className="mb-4"
                style={{
                  fontSize: '17px',
                  lineHeight: 1.78,
                  color: '#111827',
                }}
              >
                icareereos discovers opportunities, scores your fit, optimizes your profile,
                and applies for you â across jobs, gigs, and projects.
              </p>

              {/* Supporting Text */}
              <p
                className="mb-8"
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#9CA3AF',
                }}
              >
                We organize and execute career opportunities so you don't have to.
              </p>

              {/* Buttons */}
              <div className="flex gap-4 mb-6">
                <Link
                  to="/auth/signup"
                  className="px-8 py-4 font-medium text-white rounded-lg transition"
                  style={{
                    fontSize: '15px',
                    backgroundColor: '#00B8A9',
                    boxShadow: '0 2px 10px rgba(0, 184, 169, 0.3)',
                    padding: '14px 30px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a598')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B8A9')}
                >
                  Get started free
                </Link>
                <button
                  className="px-8 py-4 font-medium rounded-lg transition border"
                  style={{
                    fontSize: '15px',
                    backgroundColor: 'white',
                    color: '#0A1628',
                    borderColor: 'rgba(0, 0, 0, 0.07)',
                    padding: '14px 24px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  See how it works
                </button>
              </div>

              {/* Fine Print */}
              <p
                style={{
                  fontSize: '12px',
                  color: '#9CA3AF',
                  lineHeight: 1.5,
                }}
              >
                No credit card required Â· Takes 2 minutes to set up
              </p>
            </div>

            {/* Right Column: Dashboard Preview */}
            <div
              className="rounded-3xl p-6 space-y-4"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 10px 30px rgba(0, 0, 0, 0.08)',
                borderRadius: '18px',
                maxWidth: '380px',
                marginLeft: 'auto',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0A1628',
                  }}
                >
                  Mission Control
                </h3>
                <div
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: 'rgba(0, 184, 169, 0.1)',
                    color: '#00B8A9',
                  }}
                >
                  5 agents live
                </div>
              </div>

              {/* Job Item 1 */}
              <div className="space-y-2 pb-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#0A1628',
                        marginBottom: '2px',
                      }}
                    >
                      Senior Product Manager
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#4B5563',
                      }}
                    >
                      Stripe Â· Remote
                    </p>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      marginLeft: '8px',
                    }}
                  >
                    Auto-applied
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-2">
                  <div
                    style={{
                      width: '85%',
                      height: '100%',
                      backgroundColor: '#00B8A9',
                    }}
                  />
                </div>
              </div>

              {/* Job Item 2 */}
              <div className="space-y-2 pb-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#0A1628',
                        marginBottom: '2px',
                      }}
                    >
                      UX Research Lead
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#4B5563',
                      }}
                    >
                      Notion Â· Hybrid
                    </p>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      marginLeft: '8px',
                    }}
                  >
                    Auto-applied
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-2">
                  <div
                    style={{
                      width: '72%',
                      height: '100%',
                      backgroundColor: '#00B8A9',
                    }}
                  />
                </div>
              </div>

              {/* Gig Item 3 */}
              <div
                className="p-3 rounded-lg space-y-2 mb-4"
                style={{
                  backgroundColor: '#fffdf0',
                  border: '1px solid rgba(217, 119, 6, 0.2)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#0A1628',
                        marginBottom: '2px',
                      }}
                    >
                      Product Strategy Gig
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#4B5563',
                      }}
                    >
                      Open Market Â· $4,200
                    </p>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      marginLeft: '8px',
                    }}
                  >
                    Proposal sent
                  </div>
                </div>
              </div>

              {/* Resume Optimizer */}
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: '#EEF1F8',
                }}
              >
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#4B5563',
                    marginBottom: '4px',
                  }}
                >
                  Resume Optimizer
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#0A1628',
                    lineHeight: 1.4,
                  }}
                >
                  Added 'stakeholder alignment' Â· ATS score +12pts
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PROBLEM */}
      <section style={{ backgroundColor: '#F4F6FB', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            The problem
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            Your career is scattered across too many platforms
          </h2>

          {/* Sub */}
          <p
            className="mb-12 max-w-2xl"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            From job boards to gig platforms to spreadsheets, managing your career means
            juggling dozens of tools and losing track of opportunities.
          </p>

          {/* 2x2 Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Searching manually',
                desc: 'You waste hours scrolling job boards and platforms to find roles that match your skills.',
              },
              {
                title: 'Managing gigs separately',
                desc: 'Freelance and gig opportunities live in different systems, making it hard to track pipeline.',
              },
              {
                title: 'Rewriting resumes repeatedly',
                desc: 'Each application requires tweaking your resume for ATS compliance and keyword matching.',
              },
              {
                title: 'Tracking everything manually',
                desc: 'Spreadsheets and notes fall out of sync, causing missed deadlines and lost opportunities.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 6px 20px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full mb-4"
                  style={{ backgroundColor: '#ef4444' }}
                />
                <h3
                  className="mb-2 font-semibold"
                  style={{
                    fontSize: '16px',
                    color: '#0A1628',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: '#4B5563',
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: SOLUTION */}
      <section style={{ backgroundColor: 'white', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            The solution
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            One system to run your entire career
          </h2>

          {/* Body + Supporting */}
          <p
            className="mb-2 max-w-2xl"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            iCareerOS centralizes opportunities and automates your career growth with AI agents
            that work 24/7.
          </p>
          <div
            className="mb-12 pb-4 border-b-2"
            style={{
              borderColor: '#00B8A9',
              color: '#00B8A9',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 500,
              }}
            >
              From discovery to execution in one place
            </span>
          </div>

          {/* Pipeline Flow */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-2">
            {[
              { icon: Search, label: 'Discover', sub: 'Find opportunities' },
              { icon: Sparkles, label: 'Analyze', sub: 'Score your fit' },
              { icon: Zap, label: 'Optimize', sub: 'Enhance profile' },
              { icon: ArrowRight, label: 'Execute', sub: 'Auto-apply' },
              { icon: TrendingUp, label: 'Grow', sub: 'Track progress' },
            ].map((step, idx) => (
              <div key={idx} className="flex-1 flex flex-col md:flex-row items-center gap-4">
                <div className="flex flex-col items-center md:items-start gap-2 w-full">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: '44px',
                      height: '44px',
                      backgroundColor: '#00B8A9',
                      color: 'white',
                    }}
                  >
                    <step.icon size={20} />
                  </div>
                  <h4
                    className="font-bold text-center md:text-left"
                    style={{
                      fontSize: '14px',
                      color: '#0A1628',
                    }}
                  >
                    {step.label}
                  </h4>
                  <p
                    className="text-center md:text-left"
                    style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                    }}
                  >
                    {step.sub}
                  </p>
                </div>
                {idx < 4 && (
                  <div
                    className="hidden md:block"
                    style={{
                      width: '16px',
                      height: '1px',
                      backgroundColor: '#E5E7EB',
                      marginLeft: '8px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: HOW IT WORKS */}
      <section style={{ backgroundColor: '#F4F6FB', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            How it works
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            Your career, powered by AI agents
          </h2>

          {/* Sub */}
          <p
            className="mb-12 max-w-2xl"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            Each step of your career journey is optimized by dedicated AI agents working in
            perfect sync.
          </p>

          {/* Vertical Spine List */}
          <div
            className="mx-auto"
            style={{
              maxWidth: '580px',
            }}
          >
            {[
              {
                title: 'Profile Setup',
                desc: 'Connect your resume, skills, and preferences. Our system learns what matters to you.',
              },
              {
                title: 'Opportunity Discovery',
                desc: 'Agents scan 100+ job boards and gig platforms for roles aligned with your goals.',
              },
              {
                title: 'Intelligent Matching',
                desc: 'Each opportunity is scored on culture fit, growth potential, and compensation match.',
              },
              {
                title: 'Profile Optimization',
                desc: 'Your resume and LinkedIn are auto-tailored with relevant keywords and achievements.',
              },
              {
                title: 'Automated Application',
                desc: 'One-click applications or automated submission with personalized cover letters.',
              },
            ].map((step, idx) => (
              <div
                key={idx}
                style={{
                  paddingBottom: '32px',
                  borderBottom: idx < 4 ? '1px solid #E5E7EB' : 'none',
                }}
              >
                <div className="flex gap-4">
                  <div
                    className="flex items-center justify-center flex-shrink-0 rounded-lg text-white font-bold"
                    style={{
                      width: '34px',
                      height: '34px',
                      backgroundColor: '#00B8A9',
                      fontSize: '14px',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h4
                      className="mb-2 font-semibold"
                      style={{
                        fontSize: '16px',
                        color: '#0A1628',
                      }}
                    >
                      {step.title}
                    </h4>
                    <p
                      style={{
                        fontSize: '15px',
                        lineHeight: 1.6,
                        color: '#4B5563',
                      }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: FEATURES */}
      <section style={{ backgroundColor: 'white', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            Features
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            Built for modern careers
          </h2>

          {/* Sub */}
          <p
            className="mb-12 max-w-2xl"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            Everything you need to manage jobs, gigs, and projects in one unified platform.
          </p>

          {/* 3x2 Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: 'Smart Matching',
                desc: 'AI scores every opportunity based on your unique fit and preferences.',
                color: '#00B8A9',
              },
              {
                icon: Bot,
                title: 'Opportunity Pipeline',
                desc: 'Centralized view of all applications, proposals, and progress across platforms.',
                color: '#00B8A9',
              },
              {
                icon: BarChart3,
                title: 'Career Analytics',
                desc: 'Track your growth with detailed metrics on applications, offers, and earnings.',
                color: '#00B8A9',
              },
              {
                icon: Globe,
                title: 'Profile Optimization',
                desc: 'Auto-tailor your resume and profiles with high-impact keywords and achievements.',
                color: '#F5A623',
              },
              {
                icon: Shield,              title: 'Intelligent Negotiation',
                desc: 'Get real-time insights on market rates and negotiation tips for every offer.',
                color: '#F5A623',
              },
              {
                icon: Briefcase,
                title: 'Multi-Portfolio Support',
                desc: 'Manage multiple career profiles and scenarios simultaneously.',
                color: '#8B5CF6',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl transition hover:shadow-xl"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 6px 20px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    '0 1px 3px rgba(0, 0, 0, 0.06), 0 20px 40px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    '0 1px 3px rgba(0, 0, 0, 0.06), 0 6px 20px rgba(0, 0, 0, 0.05)';
                }}
              >
                <div
                  className="flex items-center justify-center rounded-lg mb-4"
                  style={{
                    width: '38px',
                    height: '38px',
                    backgroundColor: `${feature.color}20`,
                    color: feature.color,
                  }}
                >
                  <feature.icon size={18} />
                </div>
                <h3
                  className="mb-2 font-semibold"
                  style={{
                    fontSize: '16px',
                    color: '#0A1628',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: '#4B5563',
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: COMPARISON TABLE */}
      <section style={{ backgroundColor: '#F4F6FB', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            Why iCareerOS
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            How we compare
          </h2>

          {/* Sub */}
          <p
            className="mb-12 max-w-2xl"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            A comprehensive comparison of career management tools.
          </p>

          {/* Table */}
          <div className="overflow-x-auto">
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th
                    style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0A1628',
                    }}
                  >
                    Capability
                  </th>
                  <th
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0A1628',
                    }}
                  >
                    Job Boards
                  </th>
                  <th
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0A1628',
                    }}
                  >
                    Gig Platforms
                  </th>
                  <th
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: 'rgba(0, 184, 169, 0.1)',
                    }}
                  >
                    iCareerOS
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'AI Opportunity Discovery', job: false, gig: false, ice: true },
                  { name: 'Profile Optimization', job: false, gig: false, ice: true },
                  { name: 'Automated Applications', job: false, gig: false, ice: true },
                  { name: 'Unified Dashboard', job: false, gig: false, ice: true },
                  { name: 'Match Scoring', job: false, gig: 'partial', ice: true },
                  { name: 'Multi-Channel Tracking', job: false, gig: false, ice: true },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td
                      style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#0A1628',
                        fontWeight: 500,
                      }}
                    >
                      {row.name}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {row.job ? (
                        <CheckCircle size={18} color="#10b981" />
                      ) : (
                        <X size={18} color="#ef4444" />
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {row.gig === true ? (
                        <CheckCircle size={18} color="#10b981" />
                      ) : row.gig === 'partial' ? (
                        <Minus size={18} color="#f59e0b" />
                      ) : (
                        <X size={18} color="#ef4444" />
                      )}
                    </td>
                    <td
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(0, 184, 169, 0.05)',
                      }}
                    >
                      {row.ice && <CheckCircle size={18} color="#00B8A9" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 7: SOCIAL PROOF */}
      <section style={{ backgroundColor: 'white', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            Social Proof
          </div>

          {/* H2 */}
          <h2
            className="mb-12 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            Trusted by career-focused professionals
          </h2>

          {/* Stats Bar */}
          <div className="grid md:grid-cols-3 gap-8 mb-12 pb-12 border-b border-gray-200">
            {[
              { stat: '44+', label: 'Job Boards Integrated' },
              { stat: '100%', label: 'Opportunity Coverage' },
              { stat: '5', label: 'AI Agents Working' },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <p
                  className="mb-2 font-bold"
                  style={{
                    fontSize: '32px',
                    color: '#0A1628',
                  }}
                >
                  {item.stat}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#4B5563',
                  }}
                >
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "iCareerOS saved me hundreds of hours applying to jobs. I went from 2 interviews a month to 8 qualified leads.",
                name: 'Alex Chen',
                title: 'Product Manager',
              },
              {
                quote:
                  "The AI profile optimizer got my resume in front of more hiring managers in 2 weeks than LinkedIn did in 6 months.",
                name: 'Sarah Williams',
                title: 'UX Designer',
              },
              {
                quote:
                  "Managing freelance gigs alongside full-time job search was impossible until iCareerOS unified everything.",
                name: 'Marcus Johnson',
                title: 'Full-Stack Developer',
              },
            ].map((testimonial, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 6px 20px rgba(0, 0, 0, 0.05)',
                }}
              >
                <p
                  className="mb-4 italic"
                  style={{
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: '#4B5563',
                  }}
                >
                  "{testimonial.quote}"
                </p>
                <p
                  className="font-semibold"
                  style={{
                    fontSize: '14px',
                    color: '#0A1628',
                    marginBottom: '2px',
                  }}
                >
                  {testimonial.name}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#9CA3AF',
                  }}
                >
                  {testimonial.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: VISION (Dark) */}
      <section style={{ backgroundColor: '#0A1628', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Eyebrow */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.15)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            The Future
          </div>

          {/* H2 */}
          <h2
            className="mb-12 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: 'white',
            }}
          >
            Your complete career operating system
          </h2>

          {/* 4-Column Grid */}
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                title: 'AI-Powered Discovery',
                desc: 'Agents continuously scan global markets for opportunities aligned with your aspirations.',
              },
              {
                title: 'Real-Time Intelligence',
                desc: 'Get market insights, salary data, and competitive analysis for every opportunity.',
              },
              {
                title: 'Automated Execution',
                desc: 'From application to negotiation, AI handles the operational tasks so you focus on growth.',
              },
              {
                title: 'Lifetime Growth Tracking',
                desc: 'Build a comprehensive career history with analytics on every opportunity and outcome.',
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <h3
                  className="mb-3 font-semibold"
                  style={{
                    fontSize: '16px',
                    color: 'white',
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: FINAL CTA */}
      <section style={{ backgroundColor: 'white', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          {/* Chip */}
          <div
            className="inline-block mb-4 px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(0, 184, 169, 0.1)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#00B8A9',
            }}
          >
            Get Started
          </div>

          {/* H2 */}
          <h2
            className="mb-4 font-bold"
            style={{
              fontSize: '36px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#0A1628',
            }}
          >
            Ready to automate your career?
          </h2>

          {/* Teal Line */}
          <div
            className="mx-auto mb-6"
            style={{
              width: '60px',
              height: '3px',
              backgroundColor: '#00B8A9',
            }}
          />

          {/* Body */}
          <p
            className="mb-8"
            style={{
              fontSize: '15px',
              lineHeight: 1.78,
              color: '#4B5563',
            }}
          >
            Join hundreds of professionals leveraging AI to manage their entire career across
            jobs, gigs, and projects.
          </p>

          {/* Button */}
          <Link
            to="/auth/signup"
            className="inline-block px-8 py-4 font-medium text-white rounded-lg transition"
            style={{
              fontSize: '15px',
              backgroundColor: '#00B8A9',
              boxShadow: '0 2px 10px rgba(0, 184, 169, 0.3)',
              padding: '14px 30px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a598')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B8A9')}
          >
            Get started free
          </Link>

          {/* Fine Print */}
          <p
            className="mt-6"
            style={{
              fontSize: '12px',
              color: '#9CA3AF',
              lineHeight: 1.5,
            }}
          >
            No credit card required Â· Takes 2 minutes to set up
          </p>
        </div>
      </section>

      {/* SECTION 10: FOOTER */}
      <footer
        style={{
          backgroundColor: '#F4F6FB',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          paddingTop: '60px',
          paddingBottom: '0',
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div
            className="grid md:grid-cols-4 gap-8 pb-12"
            style={{ maxWidth: '900px', margin: '0 auto' }}
          >
            {/* Column 1: Logo + tagline */}
            <div className="md:col-span-1">
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#0A1628', marginBottom: '12px' }}>
                i<span style={{ color: '#00B8A9' }}>Career</span>OS
              </div>
              <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, marginBottom: '12px' }}>
                The operating system for your career. Runs continuously. Gets smarter over time.
              </p>
              <p style={{ fontSize: '12px', color: '#9CA3AF' }}>icareeros.com</p>
            </div>

            {/* Column 2: Product */}
            <div>
              <h4 className="mb-4 font-semibold" style={{ fontSize: '14px', color: '#0A1628' }}>
                Product
              </h4>
              <ul className="space-y-2">
                {['Features', 'How it works', 'Pricing', 'Chrome Extension'].map((link, i) => (
                  <li key={i}>
                    <a
                      href="#"
                      style={{ fontSize: '14px', color: '#4B5563', textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#00B8A9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#4B5563'; }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Company */}
            <div>
              <h4 className="mb-4 font-semibold" style={{ fontSize: '14px', color: '#0A1628' }}>
                Company
              </h4>
              <ul className="space-y-2">
                {['About', 'Mission', 'Careers', 'Contact'].map((link, i) => (
                  <li key={i}>
                    <a
                      href="#"
                      style={{ fontSize: '14px', color: '#4B5563', textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#00B8A9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#4B5563'; }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div>
              <h4 className="mb-4 font-semibold" style={{ fontSize: '14px', color: '#0A1628' }}>
                Legal
              </h4>
              <ul className="space-y-2">
                {['Privacy Policy', 'Terms of Use', 'Cookies', 'Security'].map((link, i) => (
                  <li key={i}>
                    <a
                      href="#"
                      style={{ fontSize: '14px', color: '#4B5563', textDecoration: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#00B8A9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#4B5563'; }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}
        >
          <div
            className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4"
          >
            <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
              &copy; 2026 iCareerOS &middot; Intelligent Career Operating System
            </p>
            <p style={{ fontSize: '12px', color: '#9CA3AF' }}>icareeros.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
