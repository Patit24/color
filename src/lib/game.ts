export type BetTarget =
  | "green"
  | "violet"
  | "red"
  | "big"
  | "small"
  | `number-${number}`;

export type BetStatus = "Pending" | "Won" | "Lost";

export type GameMode = "Win Go 30S" | "Win Go 1Min";
export type BackendGameMode = "30S" | "1M";

export type GameResult = {
  period: string;
  number: number;
  size: "Big" | "Small";
  color: "Green" | "Violet" | "Red";
  colors: Array<"Green" | "Violet" | "Red">;
};

export type WheelSegment = {
  number: number;
  colors: GameResult["colors"];
};

export type UserBet = {
  id: string;
  period: string;
  target: string;
  amount: number;
  status: BetStatus;
  profit: number;
};

export const gameTabs: GameMode[] = ["Win Go 30S", "Win Go 1Min"];

export const multipliers = [1, 5, 10, 20, 50, 100];

const demoDateStamp = "20260516";

export const wheelSegments: WheelSegment[] = [
  { number: 0, colors: ["Red", "Violet"] },
  { number: 1, colors: ["Green"] },
  { number: 2, colors: ["Red"] },
  { number: 3, colors: ["Green"] },
  { number: 4, colors: ["Red"] },
  { number: 5, colors: ["Green", "Violet"] },
  { number: 6, colors: ["Red"] },
  { number: 7, colors: ["Green"] },
  { number: 8, colors: ["Red"] },
  { number: 9, colors: ["Green"] },
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function toBackendGameMode(mode: GameMode): BackendGameMode {
  if (mode === "Win Go 30S") return "30S";
  return "1M";
}

export function secondsForMode(mode: GameMode) {
  if (mode === "Win Go 30S") return 30;
  return 60;
}

export function getResultColor(number: number): GameResult["color"] {
  if (number === 0) return "Red";
  if (number === 5) return "Green";
  return number % 2 === 0 ? "Red" : "Green";
}

export function getResultColors(number: number): GameResult["colors"] {
  const segment = wheelSegments.find((item) => item.number === number);
  return segment ? [...segment.colors] : [getResultColor(number)];
}

export function getResultSize(number: number): GameResult["size"] {
  return number >= 5 ? "Big" : "Small";
}

export function makePeriod(base: number) {
  return `${demoDateStamp}${base}`;
}

export function targetWins(target: BetTarget, result: GameResult) {
  if (target === "big") return result.size === "Big";
  if (target === "small") return result.size === "Small";
  if (target === "green") return result.colors.includes("Green");
  if (target === "violet") return result.colors.includes("Violet");
  if (target === "red") return result.colors.includes("Red");
  return target === `number-${result.number}`;
}

export function targetLabel(target: BetTarget) {
  if (target.startsWith("number-")) return target.replace("number-", "Number ");
  return target[0].toUpperCase() + target.slice(1);
}

export function payoutForTarget(target: BetTarget, amount: number) {
  if (target === "violet") return Math.round(amount * 4.5);
  if (target.startsWith("number-")) return amount * 9;
  if (target === "big" || target === "small") return Math.round(amount * 1.5);
  return amount * 2;
}

export function makeResult(period: string): GameResult {
  const number =
    period.split("").reduce((sum, char, index) => {
      return sum + Number(char || 0) * (index + 3);
    }, 0) % 10;

  return {
    period,
    number,
    size: getResultSize(number),
    color: getResultColor(number),
    colors: getResultColors(number),
  };
}
