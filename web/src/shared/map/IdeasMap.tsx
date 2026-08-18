import type { PublicMapIdea } from '../../features/public-ideas/types';
import { IdeasMapView } from './IdeasMapView';

interface IdeasMapProps {
  markers: PublicMapIdea[];
  className?: string;
  interactive?: boolean;
  showPopups?: boolean;
  height?: number | string;
}

/** Public initiatives map — basemap source is swappable via `shared/map/providers`. */
export function IdeasMap(props: IdeasMapProps) {
  return <IdeasMapView {...props} />;
}
