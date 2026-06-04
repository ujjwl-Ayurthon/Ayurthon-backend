// Complete AIAPGET Taxonomy
const TAXONOMY = {
  samhita: {
    label: 'संहिता',
    subjects: {
      'Charak Samhita': {
        label: 'चरक संहिता',
        sthan: {
          'Sutra Sthan':    { label: 'सूत्र स्थान',    chapters: 30 },
          'Nidan Sthan':    { label: 'निदान स्थान',   chapters: 8  },
          'Viman Sthan':    { label: 'विमान स्थान',   chapters: 8  },
          'Sharira Sthan':  { label: 'शरीर स्थान',    chapters: 8  },
          'Indriya Sthan':  { label: 'इन्द्रिय स्थान', chapters: 12 },
          'Chikitsa Sthan': { label: 'चिकित्सा स्थान', chapters: 30 },
          'Kalpa Sthan':    { label: 'कल्प स्थान',    chapters: 12 },
          'Siddhi Sthan':   { label: 'सिद्धि स्थान',  chapters: 12 }
        }
      },
      'Sushrut Samhita': {
        label: 'सुश्रुत संहिता',
        sthan: {
          'Sutra Sthan':    { label: 'सूत्र स्थान',    chapters: 46 },
          'Nidan Sthan':    { label: 'निदान स्थान',   chapters: 16 },
          'Sharira Sthan':  { label: 'शरीर स्थान',    chapters: 10 },
          'Chikitsa Sthan': { label: 'चिकित्सा स्थान', chapters: 40 },
          'Kalpa Sthan':    { label: 'कल्प स्थान',    chapters: 8  },
          'Uttara Tantra':  { label: 'उत्तर तन्त्र',   chapters: 66 }
        }
      },
      'Ashtang Hridayam': {
        label: 'अष्टांग हृदयम्',
        sthan: {
          'Sutra Sthan':    { label: 'सूत्र स्थान',    chapters: 30 },
          'Sharira Sthan':  { label: 'शरीर स्थान',    chapters: 6  },
          'Nidan Sthan':    { label: 'निदान स्थान',   chapters: 16 },
          'Chikitsa Sthan': { label: 'चिकित्सा स्थान', chapters: 22 },
          'Kalpa Sthan':    { label: 'कल्प स्थान',    chapters: 6  },
          'Uttara Sthan':   { label: 'उत्तर स्थान',    chapters: 40 }
        }
      },
      'Ashtang Sangraha': {
        label: 'अष्टांग संग्रह',
        sthan: {
          'Sutra Sthan':    { label: 'सूत्र स्थान',    chapters: 32 },
          'Sharira Sthan':  { label: 'शरीर स्थान',    chapters: 9  },
          'Nidan Sthan':    { label: 'निदान स्थान',   chapters: 15 },
          'Chikitsa Sthan': { label: 'चिकित्सा स्थान', chapters: 24 },
          'Kalpa Sthan':    { label: 'कल्प स्थान',    chapters: 8  },
          'Uttara Sthan':   { label: 'उत्तर स्थान',    chapters: 50 }
        }
      },
      'Madhav Nidan': {
        label: 'माधव निदान',
        sthan: {
          'Purva Khanda':  { label: 'पूर्व खण्ड',  chapters: 35 },
          'Uttara Khanda': { label: 'उत्तर खण्ड', chapters: 34 }
        }
      },
      'Yogratnakar': {
        label: 'योगरत्नाकर',
        sthan: {
          'Purva Khanda':  { label: 'पूर्व खण्ड',  chapters: 20 },
          'Uttara Khanda': { label: 'उत्तर खण्ड', chapters: 20 }
        }
      },
      'Bhel Samhita': {
        label: 'भेल संहिता',
        sthan: {
          'Sutra Sthan':    { label: 'सूत्र स्थान',    chapters: 30 },
          'Nidan Sthan':    { label: 'निदान स्थान',   chapters: 8  },
          'Sharira Sthan':  { label: 'शरीर स्थान',    chapters: 8  },
          'Chikitsa Sthan': { label: 'चिकित्सा स्थान', chapters: 30 },
          'Kalpa Sthan':    { label: 'कल्प स्थान',    chapters: 12 },
          'Siddhi Sthan':   { label: 'सिद्धि स्थान',  chapters: 12 }
        }
      },
      'Harit Samhita': {
        label: 'हारीत संहिता',
        sthan: {
          'Pratham Sthan': { label: 'प्रथम स्थान',  chapters: 20 },
          'Dwitiya Sthan': { label: 'द्वितीय स्थान', chapters: 20 },
          'Tritiya Sthan': { label: 'तृतीय स्थान',  chapters: 20 }
        }
      },
      'Bhavprakash': {
        label: 'भावप्रकाश',
        sthan: {
          'Poorvakhanda':  { label: 'पूर्वखण्ड',  chapters: 10 },
          'Madhyakhanda':  { label: 'मध्यखण्ड',  chapters: 70 },
          'Uttarakhanda':  { label: 'उत्तरखण्ड', chapters: 10 }
        }
      }
    }
  },

  short_subject: {
    label: 'लघु विषय',
    subjects: {
      'Rasashastra':          { label: 'रसशास्त्र',          sthan: { 'Part A': { label: 'भाग A', chapters: 15 }, 'Part B': { label: 'भाग B', chapters: 15 } } },
      'Bhaishajya Kalpana':   { label: 'भैषज्य कल्पना',      sthan: { 'General': { label: 'सामान्य', chapters: 20 } } },
      'Bhaishajya Ratnavali': { label: 'भैषज्य रत्नावली',    sthan: { 'Part A': { label: 'भाग A', chapters: 30 }, 'Part B': { label: 'भाग B', chapters: 30 } } },
      'Dravyaguna':           { label: 'द्रव्यगुण',           sthan: { 'General': { label: 'सामान्य', chapters: 25 } } },
      'Prasuti Stree Roga':   { label: 'प्रसूति एवं स्त्री रोग', sthan: { 'General': { label: 'सामान्य', chapters: 20 } } },
      'Swasthavritta':        { label: 'स्वास्थवृत्त',         sthan: { 'General': { label: 'सामान्य', chapters: 20 } } },
      'Agadtantra':           { label: 'अगदतन्त्र',           sthan: { 'General': { label: 'सामान्य', chapters: 15 } } },
      'Kaumarya Bhritya':     { label: 'कौमारभृत्य',          sthan: { 'General': { label: 'सामान्य', chapters: 15 } } },
      'Kriya Sharir':         { label: 'क्रिया शरीर',         sthan: { 'General': { label: 'सामान्य', chapters: 20 } } },
      'Rachna Sharir':        { label: 'रचना शरीर',           sthan: { 'General': { label: 'सामान्य', chapters: 20 } } },
      'Padarth Vigyan':       { label: 'पदार्थ विज्ञान',       sthan: { 'General': { label: 'सामान्य', chapters: 10 } } },
      'Sanskrit':             { label: 'संस्कृत',              sthan: { 'General': { label: 'सामान्य', chapters: 10 } } }
    }
  },

  modern: {
    label: 'आधुनिक विषय',
    subjects: {
      'Physiology':              { label: 'Physiology',              sthan: { 'General': { label: 'General', chapters: 20 } } },
      'Pathology':               { label: 'Pathology',               sthan: { 'General': { label: 'General', chapters: 20 } } },
      'Pharmacology':            { label: 'Pharmacology',            sthan: { 'General': { label: 'General', chapters: 20 } } },
      'Pharmaceutics':           { label: 'Pharmaceutics',           sthan: { 'General': { label: 'General', chapters: 20 } } },
      'Toxicology & Forensic':   { label: 'Toxicology & Forensic',   sthan: { 'General': { label: 'General', chapters: 15 } } },
      'Pediatrics':              { label: 'Pediatrics',              sthan: { 'General': { label: 'General', chapters: 15 } } },
      'Obs & Gynae':             { label: 'Obs & Gynae',             sthan: { 'General': { label: 'General', chapters: 15 } } },
      'PSM':                     { label: 'PSM',                     sthan: { 'General': { label: 'General', chapters: 15 } } }
    }
  }
};

module.exports = TAXONOMY;
