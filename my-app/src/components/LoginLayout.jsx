// LoginLayout
// - Provides a full-screen background and overlay used by the authentication page.
import React from 'react'

const LoginLayout = ({ children }) => (
  <div
    className="relative min-h-screen w-full flex items-center justify-center px-4 sm:px-6 lg:px-8"
    style={{
      backgroundImage: "url('./images/loginbackground.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    }}
  >
    {/* Logo / App name in top-left */}
    <h1 className="absolute top-4 left-4 z-20 text-white font-['Lalezar'] text-3xl">
      Kohina
    </h1>
    {/* Dark overlay */}
    <div className="absolute inset-0 bg-black opacity-75" />
    {/* Main content */}
    <div className="max-w-md w-full space-y-8 relative z-10">
      {children}
    </div>
  </div>
)

export default LoginLayout
