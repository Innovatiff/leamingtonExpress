// If the map can't load (its code didn't download, the phone's graphics failed),
// keep the rest of the page working and show the fallback instead.
import { Component } from "react";

export default class MapBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.warn("Live map unavailable", err);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
