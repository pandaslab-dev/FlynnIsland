(function attachFlynnViewport(globalScope) {
  const PHONE_PORTRAIT_SIZE = { width: 576, height: 1024 };
  const PHONE_LANDSCAPE_SIZE = { width: 1024, height: 576 };
  const TABLET_PORTRAIT_SIZE = { width: 768, height: 1024 };
  const MIN_LANDSCAPE_HEIGHT = 720;
  const MAX_LANDSCAPE_HEIGHT = 1080;
  const MIN_LANDSCAPE_ASPECT = 4 / 3;
  const MAX_LANDSCAPE_ASPECT = 21 / 9;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundToEven(value) {
    return Math.round(value / 2) * 2;
  }

  function resolveViewportFlags(width, height) {
    const safeWidth = Math.max(320, Math.round(width || 0));
    const safeHeight = Math.max(320, Math.round(height || 0));
    const shortSide = Math.min(safeWidth, safeHeight);
    const longSide = Math.max(safeWidth, safeHeight);
    const hasTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0;

    return {
      width: safeWidth,
      height: safeHeight,
      shortSide,
      longSide,
      hasTouch,
      isPortrait: safeHeight >= safeWidth,
      isTablet: hasTouch && shortSide >= 700 && longSide >= 1000
    };
  }

  function getGameSize(viewportWidth, viewportHeight) {
    const flags = resolveViewportFlags(
      viewportWidth ?? window.innerWidth,
      viewportHeight ?? window.innerHeight
    );

    if (flags.isPortrait) {
      return flags.isTablet
        ? { ...TABLET_PORTRAIT_SIZE, ...flags }
        : { ...PHONE_PORTRAIT_SIZE, ...flags };
    }

    if (flags.hasTouch && !flags.isTablet) {
      return { ...PHONE_LANDSCAPE_SIZE, ...flags };
    }

    const aspect = clamp(
      flags.width / Math.max(flags.height, 1),
      MIN_LANDSCAPE_ASPECT,
      MAX_LANDSCAPE_ASPECT
    );
    const targetHeight = clamp(
      flags.height,
      MIN_LANDSCAPE_HEIGHT,
      MAX_LANDSCAPE_HEIGHT
    );

    return {
      width: roundToEven(targetHeight * aspect),
      height: roundToEven(targetHeight),
      ...flags
    };
  }

  function getUiScale(gameWidth, gameHeight) {
    const minSide = Math.min(gameWidth, gameHeight);
    return clamp(minSide / 900, 0.85, 1.2);
  }

  globalScope.FlynnViewportScaler = {
    clamp,
    resolveViewportFlags,
    getGameSize,
    getUiScale
  };
}(window));
