// Copyright (c) 2020-2021 Drew Lemmy
// This file is part of KristWeb 2 under GPL-3.0.
// Full details: https://github.com/tmpim/KristWeb2/blob/master/LICENSE.txt
import React from "react";
import { FrownOutlined, ExclamationCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";

import { useTranslation } from "react-i18next";

import { SmallResult } from "../../components/SmallResult";
import { APIError } from "../../krist/api";

interface Props {
  error: Error;
}

export function AddressResult({ error }: Props): JSX.Element {
  const { t } = useTranslation();

  // Handle the most commonly expected errors from the API
  if (error instanceof APIError) {
    // Invalid address
    if (error.message === "invalid_parameter") {
      return <SmallResult
        status="error"
        icon={<ExclamationCircleOutlined />}
        title={t("address.resultInvalidTitle")}
        subTitle={t("address.resultInvalid")}
        fullPage
      />;
    }

    // Address not found
    if (error.message === "address_not_found") {
      return <SmallResult
        status="error"
        icon={<FrownOutlined />}
        title={t("address.resultNotFoundTitle")}
        subTitle={t("address.resultNotFound")}
        fullPage
      />;
    }
  }

  // Unknown error
  return <SmallResult
    status="error"
    icon={<QuestionCircleOutlined />}
    title={t("address.resultUnknownTitle")}
    subTitle={t("address.resultUnknown")}
    fullPage
  />;
}