// Copyright (c) 2020-2021 Drew Lemmy
// This file is part of KristWeb 2 under GPL-3.0.
// Full details: https://github.com/tmpim/KristWeb2/blob/master/LICENSE.txt
import React from "react";

import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { stripNameSuffix } from "../../utils/currency";

import { KristNameLink } from "../../components/KristNameLink";

function forceURL(link: string): string {
  // TODO: this is rather crude
  if (!link.startsWith("http")) return "https://" + link;
  return link;
}

interface Props {
  a?: string;
}

export function NameARecordLink({ a }: Props): JSX.Element | null {
  const nameSuffix = useSelector((s: RootState) => s.node.currency.name_suffix);

  if (!a) return null;

  // I don't have a citation for this other than a vague memory, but there are
  // (as of writing this) 45 names in the database whose A records begin with
  // `$` and then point to another name. There is an additional 1 name that
  // actually points to a domain, but still begins with `$` and ends with the
  // name suffix. 40 of these names end in the `.kst` suffix. Since I cannot
  // find any specification or documentation on it right now, I support both
  // formats. The suffix is stripped if it is present.
  if (a.startsWith("$")) {
    // Probably a name redirect
    const withoutPrefix = a.replace(/^\$/, "");
    const nameWithoutSuffix = stripNameSuffix(nameSuffix, withoutPrefix);

    return <KristNameLink
      name={nameWithoutSuffix}
      text={a}
      neverCopyable
    />;
  }

  return <a href={forceURL(a)} target="_blank" rel="noreferrer noopener">
    {a}
  </a>;
}
