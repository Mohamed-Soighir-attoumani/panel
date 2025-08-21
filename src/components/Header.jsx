import React from 'react';

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export default function Header() {
  const token = localStorage.getItem('token');
  const payload = token ? decodeJwt(token) : null;
  const isImpersonated = !!payload?.impersonated;

  const quitImpersonation = () => {
    const orig = localStorage.getItem('token_orig');
    if (orig) {
      localStorage.setItem('token', orig);
      localStorage.removeItem('token_orig');
      window.location.reload();
    } else {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  return (
    <header className="w-full bg-white shadow-md">
      {isImpersonated && (
        <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-1 text-center">
          Mode superadmin : vous utilisez un autre compte.
          <button
            onClick={quitImpersonation}
            className="ml-3 underline"
          >
            Revenir à mon compte
          </button>
        </div>
      )}
      <div className="p-4 font-bold">Panneau d'administration</div>
    </header>
  );
}
