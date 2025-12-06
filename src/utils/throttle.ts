/**
 * Creates a throttled function that only invokes `func` at most once
 * per every `delay` milliseconds. The throttled function comes with a
 * `cancel` method.
 *
 * @param func The function to throttle.
 * @param delay The number of milliseconds to throttle invocations to.
 * @returns The new throttled function.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): (this: ThisParameterType<T>, ...args: Parameters<T>) => void {
  let inProgress = false;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (inProgress) {
      return;
    }
    inProgress = true;
    // Apply the function immediately
    func.apply(this, args);
    setTimeout(() => {
      inProgress = false;
    }, delay);
  };
}
