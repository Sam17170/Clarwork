import { useState } from 'react';

// Palettes prédéfinies — l'utilisateur clique, aucune saisie de couleur libre
const PALETTES = [
  { nom: 'Nature & lac', hex: '#16423C, #E8A33D, #EDE4D3, #8FA8A6' },
  { nom: 'Chaleureux artisanal', hex: '#3E2724, #C9932F, #F6EEDD, #A63D2F' },
  { nom: 'Moderne épuré', hex: '#14171A, #FF5A36, #16A394, #F7F5F0' },
  { nom: 'Festif & coloré', hex: '#0E4F4C, #F0577A, #4FD1C5, #FBF7EC' },
];

const TONS = ['Familial', 'Chic & haut de gamme', 'Rustique & authentique', 'Moderne & dynamique'];

export default function GeneratorForm() {
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'result' | 'contact'
  const [resultHtml, setResultHtml] = useState('');
  const [leadId, setLeadId] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nomEntreprise: '',
    secteur: '',
    ville: '',
    paletteNom: PALETTES[0].nom,
    paletteHex: PALETTES[0].hex,
    ton: TONS[0],
    particularite: '',
    formule: 'essentiel',
  });

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, photosUrls: [] }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'La génération a échoué, réessayez.');
      }

      const data = await res.json();
      setResultHtml(data.html);
      setLeadId(data.leadId);
      setStep('result');
    } catch (err) {
      setError(err.message);
      setStep('form');
    }
  }

  if (step === 'loading') {
    return (
      <div style={styles.center}>
        <p>Génération de votre aperçu en
