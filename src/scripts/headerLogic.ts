const elements = Array.from(document.getElementsByClassName("hide-me"));
let lastScrollPos = 0;
let ticking = false;
let isHidden = false;
let hidePos = 0;

const throttleScroll = () => {
  if (!ticking) {
    setTimeout(() => {
      renderHeader();
      ticking = false;
    }, 20);
    ticking = true;
  }
};

export const initHeaderLogic = () => {
  window.addEventListener("scroll", throttleScroll, true);
};

export const cleanUpHeaderLogic = () => {
  window.removeEventListener("scroll", throttleScroll);
};

const renderHeader = () => {
  const windowY = window.scrollY;
  console.log("window.scrollY", window.scrollY);
  const threshold = 200;
  const deadZone = 10; // Pixels to scroll up before showing

  if (!elements.length) return;

  if (windowY <= threshold) {
    // Below threshold: always show
    if (isHidden) {
      elements.forEach((element) => {
        element.classList.remove("hide");
        element.classList.add("scroll-up");
      });
      isHidden = false;
    }
  } else {
    console.log("Window Y > threshhold", windowY, threshold);
    console.log("lastScrollPos", lastScrollPos);
    console.log("hidePos", hidePos);
    // Above threshold: handle direction with hysteresis
    if (windowY > lastScrollPos) {
      // Scrolling down: hide immediately
      if (!isHidden) {
        elements.forEach((element) => {
          element.classList.add("hide");
          element.classList.remove("scroll-up");
        });
        isHidden = true;
        hidePos = windowY;
        console.log("hidePosUpdated", hidePos);
      }
    } else {
      // Scrolling up: show only after dead zone
      console.log(
        "isHidden",
        isHidden,
        "windowY",
        windowY,
        "showTarget",
        lastScrollPos - deadZone,
      );
      if (isHidden && windowY < hidePos - deadZone) {
        elements.forEach((element) => {
          element.classList.remove("hide");
          element.classList.add("scroll-up");
        });
        isHidden = false;
      }
      hidePos = lastScrollPos;
    }
  }

  lastScrollPos = windowY;
};
