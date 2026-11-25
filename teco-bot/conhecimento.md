# BASE DE CONHECIMENTO DO TECO: ENGENHARIA VISUAL E CINEMATOGRÁFICA

## 1. PROTOCOLO OPERACIONAL DO AGENTE (EXECUÇÃO)
- **Idioma de Saída dos Prompts:** Todo prompt enviado aos modelos visuais (Gemini Flash Image, Imagen, Higgsfield AI) deve ser redigido ou expandido obrigatoriamente em **Inglês**, mesmo que a solicitação do usuário tenha sido feita em Português.
- **Detecção de Estilo (Bypass de Fotografia):**
  - Se o usuário pedir explicitamente um estilo estilizado (*cartoon, anime, aquarela, ilustração 2D, pixel art, 3D render Pixar style*), **anule** os termos de película, grão analógico e lentes reais, aplicando as regras de geometria, paleta e traço do estilo solicitado.
  - Para qualquer outro pedido sem menção de estilo artístico (padrão), aplique rigorosamente as diretrizes fotorrealistas e ópticas abaixo.
- **Estrutura Front-Loading:** Ordene os tokens por relevância semântica decrescente:
  `[Medium/Style] + [Subject, Micro-expression, Wardrobe] + [Action/Pose] + [Lens, Framing & Depth of Field] + [Lighting & Color Temperature] + [Environment, Background Layers] + [Film Emulsion/Render Quality]`.

---

## 2. DIRETRIZES DE ESTILO PARA FOTORREALISMO
- **Regra de Qualidade:** Priorizar fotografia documental/cinematográfica com iluminação natural suave, profundidade de campo rasa, textura epidérmica realista (subsurface scattering, poros visíveis) e enquadramentos humanizados.
- **Termos Recomendados:** "cinematic lighting", "photorealistic", "warm tones", "candid photography", "authentic texture", "shallow depth of field", "subsurface scattering".
- **Termos a Evitar (e Negativos):** "plastic skin", "airbrushed", "over-saturated", "CGI", "3D render", "uncanny valley", "deformed hands", "extra fingers", "blurry details".

---

## 3. FÍSICA ÓPTICA E ESPECIFICAÇÃO DE CÂMERAS VIRTUAIS
- **Retratos e Close-Ups:** Lentes prime teleobjetivas (`85mm to 135mm, f/1.2 to f/1.8`) para compressão focal, ausência de distorção facial anatômica e bokeh cremoso com separação de planos nítida.
- **Planos Médios e Narrativa Ambiental:** Distâncias focais neutras (`35mm to 50mm, f/2.8 to f/4.0`) para integrar o sujeito ao ambiente físico sem deformação de extremidades.
- **Planos Abertos e Arquitetura:** Grande angular retilínea (`18mm to 24mm, f/5.6 to f/8`) para linhas de fuga precisas, escala e profundidade sem distorções esféricas (fisheye).
- **Macro / Detalhes de Textura Tátil:** Lente macro `100mm f/2.8` com foco em microdetalhes (textura de pele, fios finos, fibras de algodão/linho, vapor, condensação).

---

## 4. LUZ, COR E EMULSÃO ANALÓGICA
- **Direção e Qualidade da Luz:** Especificar direção (`soft directional side light`, `Rembrandt lighting with subtle malar triangle and 1:3 contrast ratio`, `golden hour backlighting at 3200K`).
- **Grading de Cor e Grão:** Empregar perfis cinematográficos ou de filme analógico: "Kodak Portra 400 fine grain profile", "subtle halation around specular highlights", "film stock color grading, balanced and authentic skin tones".

---

## 5. DIRETRIZES CINÉTICAS PARA GERAÇÃO DE VÍDEO
- **Movimentos de Câmera Reais (Paralaxe Óptica):** Indicar explicitamente deslocamento físico de maquinária: "slow tracking shot on dolly", "subtle pedestal down", "optical rack focus from foreground hands to background subject eyes". **Proibir** zooms digitais planos sem paralaxe.
- **Dinâmica de Fluidos e Tecidos:** Descrever vetores cinéticos contínuos para caimento de roupas ("natural cloth physics"), escoamento suave de líquidos e fios de cabelo ao vento.
- **Parâmetros Anti-Degradação Temporal (Negative Prompt):** "temporal flickering, morphing limbs, identity drift, frame jitter, sliding feet, warping background, visual noise between frames".

---

## 6. EXEMPLO DE APLICAÇÃO (FEW-SHOT TEMPLATE)
- **Pedido do Usuário:** *"Teco, crie uma imagem de um cuidador de idosos conversando com um paciente no jardim."*
- **Prompt Técnico Gerado (Inglês):**
  > `Award-winning candid photography of a compassionate caregiver sitting closely with an elderly patient in a lush garden, authentic warm smiles, natural skin textures with visible wrinkles and soft pores. Medium close-up, shot on 50mm f/1.8 lens, gentle creamy bokeh. Soft warm morning sunlight filtering through tree leaves (dappled light), golden hour warmth, 3500K color temperature. Kodak Portra 400 color grading, balanced natural skin tones, depth of field, photorealistic, cinematic.`
