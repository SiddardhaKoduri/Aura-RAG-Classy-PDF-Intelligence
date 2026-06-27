import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  Mail,
  Key
} from 'lucide-react';
import { sendOtpEmail } from '../utils/emailService';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export interface UserAccount {
  username: string;
  email: string;
  password: string;
}

// Migrate legacy simple string passwords to new schema
const migrateLegacyAccount = (username: string, value: string | UserAccount): UserAccount => {
  if (typeof value === 'string') {
    return {
      username: username,
      email: `${username.toLowerCase()}@example.com`,
      password: value
    };
  }
  return value;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  // Forgot credentials modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [showOtpNotification, setShowOtpNotification] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleModeToggle = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    resetForm();
  };

  const handleOpenForgotModal = () => {
    setForgotError('');
    setForgotEmail('');
    setEnteredOtp('');
    setGeneratedOtp('');
    setForgotStep('email');
    setShowOtpNotification(false);
    setIsForgotOpen(true);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    const trimmedEmail = forgotEmail.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setForgotError('Please enter your email.');
      return;
    }

    // Load registered accounts
    const savedAccountsRaw = localStorage.getItem('aura-user-accounts');
    const accounts: Record<string, string | UserAccount> = savedAccountsRaw ? JSON.parse(savedAccountsRaw) : {};

    // Search account by email
    let foundAccount: UserAccount | null = null;
    for (const key of Object.keys(accounts)) {
      const account = migrateLegacyAccount(key, accounts[key]);
      if (account.email.toLowerCase() === trimmedEmail) {
        foundAccount = account;
        break;
      }
    }

    if (!foundAccount) {
      setForgotError('No account found with this email address.');
      return;
    }

    // Generate simulated 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setResolvedUsername(foundAccount.username);

    // Call real email sending logic
    const emailProvider = import.meta.env.VITE_EMAIL_PROVIDER || 'mock';
    if (emailProvider !== 'mock') {
      setForgotError('Sending OTP verification email...');
      const sendResult = await sendOtpEmail({
        to: foundAccount.email,
        username: foundAccount.username,
        otp: otp
      });
      
      if (!sendResult.success) {
        setForgotError(sendResult.message);
        return;
      }
      setForgotError(''); // clear any status
    }

    setForgotStep('otp');
    if (emailProvider === 'mock') {
      setShowOtpNotification(true);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (enteredOtp.trim() !== generatedOtp) {
      setForgotError('Invalid OTP code. Please check and try again.');
      return;
    }

    // Authenticate user
    if (rememberMe) {
      localStorage.setItem('aura-remember-user', resolvedUsername);
    } else {
      sessionStorage.setItem('aura-active-user', resolvedUsername);
    }

    setShowOtpNotification(false);
    setIsForgotOpen(false);
    onLoginSuccess(resolvedUsername);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUserOrEmail = username.trim();
    if (mode === 'login') {
      if (!trimmedUserOrEmail || !password) {
        setError('Please fill in all fields.');
        return;
      }

      const savedUsersRaw = localStorage.getItem('aura-user-accounts');
      const users: Record<string, string | UserAccount> = savedUsersRaw ? JSON.parse(savedUsersRaw) : {};

      let matchingAccount: UserAccount | null = null;
      const searchKey = trimmedUserOrEmail.toLowerCase();

      for (const key of Object.keys(users)) {
        const migrated = migrateLegacyAccount(key, users[key]);
        if (migrated.username.toLowerCase() === searchKey || migrated.email.toLowerCase() === searchKey) {
          matchingAccount = migrated;
          break;
        }
      }

      if (matchingAccount && matchingAccount.password === password) {
        if (rememberMe) {
          localStorage.setItem('aura-remember-user', matchingAccount.username);
        } else {
          sessionStorage.setItem('aura-active-user', matchingAccount.username);
        }
        onLoginSuccess(matchingAccount.username);
      } else {
        setError('Invalid username, email, or password.');
      }
    } else {
      // Signup Mode
      const trimmedUser = username.trim();
      const trimmedEmail = email.trim();
      if (!trimmedUser || !trimmedEmail || !password || !confirmPassword) {
        setError('Please fill in all fields.');
        return;
      }

      if (trimmedUser.length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      const savedUsersRaw = localStorage.getItem('aura-user-accounts');
      const users: Record<string, string | UserAccount> = savedUsersRaw ? JSON.parse(savedUsersRaw) : {};

      const lowerUser = trimmedUser.toLowerCase();
      const lowerEmail = trimmedEmail.toLowerCase();

      for (const key of Object.keys(users)) {
        const migrated = migrateLegacyAccount(key, users[key]);
        if (migrated.username.toLowerCase() === lowerUser) {
          setError('Username is already taken.');
          return;
        }
        if (migrated.email.toLowerCase() === lowerEmail) {
          setError('Email is already registered.');
          return;
        }
      }

      const newAccount: UserAccount = {
        username: trimmedUser,
        email: trimmedEmail,
        password: password
      };

      users[lowerUser] = newAccount;
      localStorage.setItem('aura-user-accounts', JSON.stringify(users));

      if (rememberMe) {
        localStorage.setItem('aura-remember-user', newAccount.username);
      } else {
        sessionStorage.setItem('aura-active-user', newAccount.username);
      }
      onLoginSuccess(newAccount.username);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background soft lighting glow */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(0, 113, 227, 0.08) 0%, rgba(0,0,0,0) 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        pointerEvents: 'none'
      }}></div>

      {/* Floating Glass Login Card */}
      <div 
        className="glass-card fade-in"
        style={{
          width: '380px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          zIndex: 5,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), #1C1C1E)',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0, 113, 227, 0.3)'
          }}>
            <Sparkles size={22} color="white" />
          </div>
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '1.5px',
              background: 'linear-gradient(90deg, #FFFFFF, #8E8E93)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              AURA INTELLIGENCE
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>
              Frosted PDF Workspace
            </p>
          </div>
        </div>

        {/* Error panel */}
        {error && (
          <div style={{
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.25)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username or Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="glass-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? 'Enter username or email' : 'Enter username'}
                style={{ paddingLeft: '40px' }}
                autoFocus
                required
              />
            </div>
          </div>

          {/* Email Address (only signup) */}
          {mode === 'signup' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="glass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter password' : 'At least 6 characters'}
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (only signup) */}
          {mode === 'signup' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Confirm Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="glass-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>
          )}

          {/* Options (Remember me / Forgot password link) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  accentColor: 'var(--color-primary)',
                  cursor: 'pointer'
                }}
              />
              Remember me
            </label>
            {mode === 'login' && (
              <span 
                onClick={handleOpenForgotModal}
                style={{ color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Forgot credentials?
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '14px', 
              fontWeight: 600, 
              marginTop: '8px',
              boxShadow: '0 4px 15px rgba(0, 113, 227, 0.3)'
            }}
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Form Toggle Link */}
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: '6px'
        }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <span 
                onClick={handleModeToggle} 
                style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign Up
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span 
                onClick={handleModeToggle} 
                style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign In
              </span>
            </>
          )}
        </div>
      </div>

      {/* Simulated OTP Notification toast */}
      {showOtpNotification && (
        <div className="glass-toast fade-in" style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '16px 24px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.2) 0%, rgba(0, 113, 227, 0.05) 100%)',
          border: '1px solid rgba(0, 113, 227, 0.4)',
          boxShadow: '0 8px 32px rgba(0, 113, 227, 0.2)',
          color: 'white',
          zIndex: 100,
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Sparkles size={16} />
            Simulated Email Sent
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
            Your one-time passcode (OTP) for account <strong>{resolvedUsername}</strong> is:
          </p>
          <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '4px', marginTop: '8px', color: 'var(--color-primary)' }}>
            {generatedOtp}
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => setShowOtpNotification(false)}
            style={{ marginTop: '12px', padding: '4px 12px', fontSize: '11px', height: 'auto' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Forgot Credentials Modal Dialog */}
      {isForgotOpen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div 
            className="glass-card fade-in"
            style={{
              width: '380px',
              padding: '30px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <HelpCircle size={18} color="var(--color-primary)" />
                <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>Credential Recovery</span>
              </div>
              <button 
                onClick={() => {
                  setIsForgotOpen(false);
                  setShowOtpNotification(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            {forgotStep === 'email' ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Enter your registered email address below. We'll simulate sending a 6-digit OTP code to verify your identity.
                </p>

                {/* Error inside modal */}
                {forgotError && (
                  <div style={{
                    background: 'rgba(255, 69, 58, 0.08)',
                    border: '1px solid rgba(255, 69, 58, 0.25)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{forgotError}</span>
                  </div>
                )}

                {/* Email input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      className="glass-input"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter registered email"
                      style={{ paddingLeft: '40px', fontSize: '13px' }}
                      required
                    />
                  </div>
                </div>

                {/* Submit Reset */}
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    fontSize: '13px', 
                    fontWeight: 600,
                    marginTop: '4px'
                  }}
                >
                  Send OTP Verification Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  An OTP has been simulated for email <strong>{forgotEmail}</strong> (see floating banner above). Please enter the 6-digit code to log in directly.
                </p>

                {/* Error inside modal */}
                {forgotError && (
                  <div style={{
                    background: 'rgba(255, 69, 58, 0.08)',
                    border: '1px solid rgba(255, 69, 58, 0.25)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{forgotError}</span>
                  </div>
                )}

                {/* OTP input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Enter 6-Digit OTP</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Key size={15} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="glass-input"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="e.g. 123456"
                      maxLength={6}
                      style={{ paddingLeft: '40px', fontSize: '14px', letterSpacing: '2px', fontWeight: 700 }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setForgotStep('email');
                      setShowOtpNotification(false);
                    }}
                    style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ flex: 2, padding: '10px', fontSize: '13px', fontWeight: 600 }}
                  >
                    Verify & Log In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
