import { project } from '../geo/project';
import type { Confidence } from './eras';

export type LandmarkId =
  | 'eastLanding' | 'westLanding' | 'church' | 'plaza' | 'paseoJulia'
  | 'bridgeSouth' | 'bridgeNorth' | 'mouth' | 'elYunque';

export const LANDMARKS: Record<LandmarkId, { lat: number; lon: number; label: string; sources: string[]; confidence: Confidence }> = {
  eastLanding: { lat: 18.4342, lon: -65.8815, label: 'Estación de El Ancón (Loíza)', sources: ['S9', 'S26'], confidence: 'M' },
  westLanding: { lat: 18.4355, lon: -65.8831, label: 'Torrecilla Baja landing', sources: ['S26'], confidence: 'M' },
  church: { lat: 18.4333, lon: -65.8796, label: 'Parroquia Espíritu Santo y San Patricio', sources: ['S14', 'S26'], confidence: 'H' },
  plaza: { lat: 18.4328, lon: -65.8799, label: 'Plaza de Loíza', sources: ['S26'], confidence: 'H' },
  paseoJulia: { lat: 18.4334, lon: -65.8818, label: 'Paseo Julia de Burgos', sources: ['S26'], confidence: 'H' },
  bridgeSouth: { lat: 18.432, lon: -65.8831, label: 'PR-187 bridge, south end', sources: ['S26'], confidence: 'H' },
  bridgeNorth: { lat: 18.4355, lon: -65.8846, label: 'PR-187 bridge, north end', sources: ['S26'], confidence: 'H' },
  mouth: { lat: 18.4383, lon: -65.8783, label: 'Río Grande de Loíza mouth', sources: ['S13'], confidence: 'H' },
  elYunque: { lat: 18.3103, lon: -65.7911, label: 'El Yunque peak (Sierra de Luquillo)', sources: ['S1'], confidence: 'M' },
};

export const landmarkXZ = (id: LandmarkId) => project(LANDMARKS[id].lat, LANDMARKS[id].lon);
