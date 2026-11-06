import { useMemo } from "react";
import { writMediaDataUri } from "../../nft/renderWritSvg";
import type { Writ } from "../../chain/types";
import { getTemplate } from "../../templates/registry";
import { writNumber } from "../../utils/amounts";
import s from "./NftFace.module.css";
export function NftFace({ writ }: { writ: Writ }) {
  const src = useMemo(() => writMediaDataUri(writ), [writ]);
  return (
    <img
      className={s.face}
      src={src}
      alt={`Writ ${writNumber(writ.id)}, ${getTemplate(writ.templateId).name}, ${writ.status}. Held by ${writ.owner}.`}
      width="1000"
      height="1000"
    />
  );
}
