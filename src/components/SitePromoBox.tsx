import { useState } from 'react';

export function SitePromoBox() {
  const [hidden, setHidden] = useState(false);

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
        <div className="promo-gif-wrap">
          <img src="/miku-vocaloid.gif" alt="Miku promo" className="promo-gif" />
        </div>
      </div>
    </div>
  );
}

