"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Hook for page-flip SFX once audio is wired. */
  onOpened?: () => void;
};

export function DiarySheet({ open, onClose, onOpened }: Props) {
  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      id="diary"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTransitionEnd={(e) => {
        if (open && e.propertyName === "opacity" && e.target === e.currentTarget) {
          onOpened?.();
        }
      }}
    >
      <div className="scrollwrap" onClick={(e) => e.stopPropagation()}>
        <div className="rod" aria-hidden />
        <div className="paper">
          <h1>The Shore Log</h1>
          <div className="sub">Written in salt and charcoal</div>

          <h2>Day 14</h2>
          <ul>
            <li>
              Rain overnight. The cup filled to the brim{" "}
              <span className="d water">+18 Water</span>
            </li>
            <li>
              Found a crab under a rock. Cooked it before dark{" "}
              <span className="d food">+10 Food</span>
            </li>
            <li>
              Fire held through the wind{" "}
              <span className="d comf">+15 Comfort</span>
            </li>
          </ul>

          <h2>Day 13</h2>
          <ul>
            <li>
              Cut three trunks before noon{" "}
              <span className="d food">−8 Food</span>
              <span className="d water">−12 Water</span>
            </li>
            <li>
              Finished the lean-to. Shade at last{" "}
              <span className="d comf">+10 Comfort</span>
            </li>
            <li>
              Scraped a knuckle on coral. Bound it{" "}
              <span className="d hp">−4 Health</span>
            </li>
          </ul>

          <h2>Day 12</h2>
          <ul>
            <li>
              Scoured the tideline until the light went gold. One coconut, two
              stones, a matchbox that still struck{" "}
              <span className="d food">+5 Food</span>
              <span className="d water">+10 Water</span>
            </li>
            <li>
              Slept badly on sand. The mat can wait{" "}
              <span className="d comf">−6 Comfort</span>
            </li>
          </ul>

          <p className="fade">
            Older pages have gone soft in the damp. The charcoal runs when it
            rains.
          </p>
        </div>
        <div className="rod" aria-hidden />
      </div>
      <button
        type="button"
        className="sheetClose"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Close
      </button>
    </div>
  );
}
