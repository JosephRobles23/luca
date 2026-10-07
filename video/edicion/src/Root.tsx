import React from 'react';
import {Composition} from 'remotion';
import {LucaDemo, totalSeconds} from './LucaDemo';

const FPS = 30;

// LucaDemo: grabación completa con tu voz. LucaNarrado: montaje acelerado con la voz de Sulafat (narracion-demo.json).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LucaDemo"
      component={LucaDemo}
      defaultProps={{variant: 'original' as const}}
      durationInFrames={Math.ceil(totalSeconds('original') * FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="LucaNarrado"
      component={LucaDemo}
      defaultProps={{variant: 'narrado' as const}}
      durationInFrames={Math.ceil(totalSeconds('narrado') * FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
