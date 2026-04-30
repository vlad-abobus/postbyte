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
        <h2>Выставочный режим</h2>
        <button
          type="button"
          className="promo-closebutton"
          onClick={close}
          aria-label="Закрыть блок"
          title="Закрыть"
        >
          ×
        </button>
      </div>
      <div className="promo-boxcontent">
        {!imageHidden ? (
          <div className="promo-gif-wrap">
            <img
              src="/miku-vocaloid.gif"
              alt="Выставочный баннер"
              className="promo-gif"
              onError={() => setImageHidden(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <p className="text-xs opacity-70">Баннер временно недоступен.</p>
        )}
      </div>
    </div>
  );
}

