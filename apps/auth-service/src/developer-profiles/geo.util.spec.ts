import { haversineDistanceKm } from './geo.util';

describe('haversineDistanceKm', () => {
  it('retourne 0 pour deux points identiques', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineDistanceKm(paris, paris)).toBeCloseTo(0, 3);
  });

  it('calcule correctement une grande distance (Paris ↔ Lyon ≈ 392 km)', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const lyon = { latitude: 45.764, longitude: 4.8357 };
    expect(haversineDistanceKm(paris, lyon)).toBeCloseTo(392, -1);
  });

  it('calcule correctement une petite distance entre villes limitrophes (Rouen ↔ Mont-Saint-Aignan ≈ 2 km)', () => {
    const rouen = { latitude: 49.4431, longitude: 1.0993 };
    const montSaintAignan = { latitude: 49.4571, longitude: 1.0817 };
    const distance = haversineDistanceKm(rouen, montSaintAignan);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(5);
  });

  it('est symétrique', () => {
    const a = { latitude: 49.4431, longitude: 1.0993 };
    const b = { latitude: 45.764, longitude: 4.8357 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 6);
  });
});
