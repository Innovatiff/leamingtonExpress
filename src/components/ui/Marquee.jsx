import { useLayoutEffect, useRef, useState } from "react";

/**
 * A row that scrolls by itself forever, like a news ticker. Its content is repeated
 * enough times to fill wide screens without a gap; it pauses while the pointer or
 * keyboard focus is on it, and people who prefer less motion get a still row they
 * can scroll by hand. `speed` is in pixels per second.
 */
export default function Marquee({ children, speed = 50, reverse = false, label, className = "" }) {
  const rootRef = useRef(null);
  const groupRef = useRef(null);
  const [fit, setFit] = useState({ repeat: 1, seconds: 30 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const group = groupRef.current;
    if (!root || !group) return undefined;
    const measure = () => {
      setFit((cur) => {
        const one = group.scrollWidth / cur.repeat;
        if (!one) return cur;
        const repeat = Math.max(1, Math.ceil(root.clientWidth / one));
        const seconds = Math.max(8, Math.round((one * repeat) / speed));
        return repeat === cur.repeat && seconds === cur.seconds ? cur : { repeat, seconds };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [speed, children]);

  const copies = Array.from({ length: fit.repeat }, (_, i) => (
    <div key={i} className="marquee__copy">
      {children}
    </div>
  ));
  return (
    <div ref={rootRef} className={`marquee ${reverse ? "marquee--reverse" : ""} ${className}`} role="region" aria-label={label}>
      <div className="marquee__track" style={{ "--marquee-seconds": `${fit.seconds}s` }}>
        <div ref={groupRef} className="marquee__group">
          {copies}
        </div>
        <div className="marquee__group" aria-hidden="true" inert>
          {copies}
        </div>
      </div>
    </div>
  );
}
