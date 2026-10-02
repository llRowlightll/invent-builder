import React from "react";
import { Composition } from "remotion";
import { Trailer } from "./Trailer";
import T from "./tidslinje.json";

const LANGD = Math.round(T.langd * T.fps);

/** Samma film i tre format: hemsidan, LinkedIn-flödet, stories. */
export const Root: React.FC = () => (
  <>
    <Composition id="Trailer169" component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1920} height={1080} />
    <Composition id="Trailer11"  component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1080} height={1080} />
    <Composition id="Trailer916" component={Trailer} durationInFrames={LANGD} fps={T.fps} width={1080} height={1920} />
  </>
);
