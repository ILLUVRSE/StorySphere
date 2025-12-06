import { loadBeverlyHillbilliesSeasonsWithDurations } from "@/lib/media";
import SeriesView from "./series-view";

export default function SeriesPage() {
  const seasons = loadBeverlyHillbilliesSeasonsWithDurations();

  return <SeriesView seasons={seasons} />;
}
