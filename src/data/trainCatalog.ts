export interface CatalogItem {
  type: string;
  era: 'classic' | 'modern' | 'future';
  city: string;
  label: string;
  kind: 'head' | 'carriage';
  carriageType?: 'standard' | 'widebody';
  description: string;
}

export const trainCatalog: CatalogItem[] = [
  // Modern era
  { type: 'tokyo-modern', era: 'modern', city: 'tokyo', label: 'Tokyo', kind: 'head', description: 'Sleek and fast, inspired by Japanese bullet trains' },
  { type: 'beijing-modern', era: 'modern', city: 'beijing', label: 'Beijing', kind: 'head', description: 'Strong and reliable, from the capital of China' },
  // Classic era
  { type: 'london-classic', era: 'classic', city: 'london', label: 'London', kind: 'head', description: 'The original Underground style from England' },
  { type: 'newyork-classic', era: 'classic', city: 'newyork', label: 'New York', kind: 'head', description: 'Bold subway design from the Big Apple' },
  // Future era
  { type: 'neo-future', era: 'future', city: 'neo', label: 'Neo', kind: 'head', description: 'Futuristic maglev with glowing edges' },
  { type: 'quantum-future', era: 'future', city: 'quantum', label: 'Quantum', kind: 'head', description: 'Next-gen hyperloop technology' },
  // Carriages
  { type: 'standard', era: 'modern', city: 'generic', label: 'Standard', kind: 'carriage', carriageType: 'standard', description: 'Regular size carriage — fits most lines' },
  { type: 'widebody', era: 'modern', city: 'generic', label: 'Wide-body', kind: 'carriage', carriageType: 'widebody', description: 'Extra wide — carries more passengers!' },
];
