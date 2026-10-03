import React from "react";
import { Composition } from "remotion";
import { Trailer } from "./Trailer";
import { SajtTrailer } from "./sajt/SajtTrailer";
import { LinkedinFilm } from "./linkedin/LinkedinFilm";
import T from "./tidslinje.json";
import S from "./sajt/tidslinje.json";
import L from "./linkedin/tidslinje.json";

const LANGD = Math.round(T.langd * T.fps);
const SAJT = Math.round(S.langd * S.fps);
const LI = Math.round(L.langd * L.fps);

export const Root: React.FC = () => (
  <>
    {/* LinkedIn-filmen: 15 sekunder, en användare skriver och sajten svarar. */}
    <Composition id="Linkedin11"  component={LinkedinFilm} durationInFrames={LI} fps={L.fps} width={1080} height={1080} />
    <Composition id="Linkedin169" component={LinkedinFilm} durationInFrames={LI} fps={L.fps} width={1920} height={1080} />
    <Composition id="Linkedin916" component={LinkedinFilm} durationInFrames={LI} fps={L.fps} width={1080} height={1920} />

    {/* Sajttrailern: hela maskinval.se på 18 sekunder. */}
    <Composition id="Sajt169" component={SajtTrailer} durationInFrames={SAJT} fps={S.fps} width={1920} height={1080} />
    <Composition id="Sajt11"  component={SajtTrailer} durationInFrames={SAJT} fps={S.fps} width={1080} height={1080} />
    <Composition id="Sajt916" component={SajtTrailer} durationInFrames={SAJT} fps={S.fps} width={1080} height={1920} />

    {/* Den längre ritningsfilmen om verifieringen. */}
    <Composition id="Trailer169" component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1920} height={1080} />
    <Composition id="Trailer11"  component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1080} height={1080} />
    <Composition id="Trailer916" component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1080} height={1920} />
  </>
);
