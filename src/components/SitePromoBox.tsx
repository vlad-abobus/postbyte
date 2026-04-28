import { useState } from 'react';

export function SitePromoBox() {
  const [hidden, setHidden] = useState(false);
  const [imageHidden, setImageHidden] = useState(false);

  const close = () => {
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="promo-box mb-4">
      <div className="promo-boxbar">
        <h2>Miku lol</h2>
        <button
          type="button"
          className="promo-closebutton"
          onClick={close}
          aria-label="Close promo"
          title="Close"
        >
          ×
        </button>
      </div>
      <div className="promo-boxcontent">
        {!imageHidden ? (
          <div className="promo-gif-wrap">
            <img
              src="https://media.tenor.com/K9fEG4M2f3AAAAAC/hatsune-miku.gif"
              alt="Miku promo"
              className="promo-gif"
              onError={() => setImageHidden(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <p className="text-xs opacity-70">Miku promo is temporarily unavailable.</p>
        )}
      </div>
    </div>
  );
}

