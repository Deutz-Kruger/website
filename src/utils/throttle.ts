type ThrottledFunction<T extends (...args: unknown[]) => unknown> = {
  (this: ThisParameterType<T>, ...args: Parameters<T>): void;
  cancel: () => void;
};

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): ThrottledFunction<T> {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | null = null;
  console.log("Throttle triggered", func);
  const throttledFunc: ThrottledFunction<T> = function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ) {
    const now = Date.now();
    console.log("NOW, LAST CALL", now, lastCall);
    if (now - lastCall >= delay) {
      func.apply(this, args);
      lastCall = now;
    } else {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(
        () => {
          func.apply(this, args);
          lastCall = Date.now();
          timeout = null;
        },
        delay - (now - lastCall),
      );
    }
  };

  console.log("Throttled Func", throttledFunc);

  throttledFunc.cancel = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return throttledFunc;
}
