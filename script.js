"use strict";

const datetime = document.getElementById("datetime");
const timezone = document.getElementById("timezone");
const formatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

timezone.textContent = `端末のタイムゾーン：${formatter.resolvedOptions().timeZone}`;

function updateClock() {
  const now = new Date();
  datetime.dateTime = now.toISOString();
  datetime.textContent = formatter.format(now);
}

updateClock();
setInterval(updateClock, 1000);
