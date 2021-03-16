// Copyright (c) 2020-2021 Drew Lemmy
// This file is part of KristWeb 2 under GPL-3.0.
// Full details: https://github.com/tmpim/KristWeb2/blob/master/LICENSE.txt
import { useState, Dispatch, SetStateAction } from "react";
import { Modal, Form, notification } from "antd";

import { useTFns } from "@utils/i18n";

import {
  useWallets, useMasterPasswordOnly,
  decryptAddresses, DecryptErrorGone, DecryptErrorFailed,
  ValidDecryptedAddresses
} from "@wallets";
import { useNameSuffix } from "@utils/currency";

import { transferNames, updateNames } from "@api/names";
import { useAuthFailedModal } from "@api/AuthFailed";

import { NameOption, fetchNames, buildLUT } from "./lookupNames";
import { handleError } from "./handleErrors";

import { NamePicker } from "./NamePicker";
import { AddressPicker } from "@comp/addresses/picker/AddressPicker";
import { ARecordInput } from "./ARecordInput";
import { showConfirmModal } from "./ConfirmModal";
import { SuccessNotifContent } from "./SuccessNotifContent";

import awaitTo from "await-to-js";

export type Mode = "transfer" | "update";

interface FormValues {
  names: string[];
  recipient?: string;
  aRecord?: string;
}

interface Props {
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;

  name?: string;
  aRecord?: string | null;
  mode: Mode;
}

export function NameEditModal({
  visible,
  setVisible,
  name,
  aRecord,
  mode
}: Props): JSX.Element {
  // Return translated strings with the correct prefix depending on the mode
  const tFns = useTFns(mode === "transfer" ? "nameTransfer." : "nameUpdate.");
  const { t, tKey, tStr, tErr } = tFns;

  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  // Used to filter out names owned by the recipient (for transfers)
  const [names, setNames] = useState<string[] | undefined>();
  const [recipient, setRecipient] = useState<string | undefined>();

  // Confirmation modal used for when transferring multiple names.
  // This is created here to provide a translation context for the modal.
  const [confirmModal, contextHolder] = Modal.useModal();
  // Modal used when auth fails
  const { showAuthFailed, authFailedContextHolder } = useAuthFailedModal();
  // Context for translation in the success notification
  const [notif, notifContextHolder] = notification.useNotification();

  // Used to fetch the list of available names
  const { walletAddressMap } = useWallets();
  const nameSuffix = useNameSuffix();
  // Used to decrypt the wallets for transfer/update
  const masterPassword = useMasterPasswordOnly();

  // Wrap the handleError function
  const onError = handleError.bind(
    handleError,
    tFns, showAuthFailed, walletAddressMap
  );

  // Actually perform the bulk name edit
  async function handleSubmit(
    names: NameOption[],
    recipient?: string,
    aRecord?: string
  ) {
    if (!masterPassword) return;

    // Attempt to decrypt each wallet. Group the names by wallet to create a
    // LUT of decrypted privatekeys.
    const nameOwners = names.map(n => n.owner);
    const decryptResults = await decryptAddresses(
      masterPassword, walletAddressMap, nameOwners
    );

    // Check if there were any decryption errors
    if (Object.values(decryptResults).includes(DecryptErrorGone))
      throw tErr("errorWalletGone");

    const decryptFailed = Object.entries(decryptResults)
      .find(([_, r]) => r === DecryptErrorFailed);
    if (decryptFailed) {
      throw new Error(t(
        tKey("errorWalletDecrypt"),
        { address: decryptFailed[0] }
      ));
    }

    // We've already validated the names, so these can be cast
    const finalAddresses = decryptResults as ValidDecryptedAddresses;
    const finalNames = names.map(n => ({ name: n.key, owner: n.owner }));

    if (mode === "transfer") {
      // Transfer the names
      await transferNames(finalAddresses, finalNames, recipient!);
    } else if (mode === "update") {
      // Update the names
      await updateNames(finalAddresses, finalNames, aRecord!);
    }

    // Success! Show notification and close modal
    const count = names.length;
    notif.success({
      message: t(tKey("successMessage"), { count }),
      description: <SuccessNotifContent
        count={count}
        recipient={recipient}
        mode={mode}
      />
    });

    setSubmitting(false);
    closeModal();
  }

  // Validate the form and consolidate all the data before submission
  async function onSubmit() {
    setSubmitting(true);

    // Get the form values
    const [err, values] = await awaitTo(form.validateFields());
    if (err || !values) {
      // Validation errors are handled by the form
      setSubmitting(false);
      return;
    }
    const { names, recipient, aRecord } = values;

    // Lookup the names list one last time, to associate the name owners
    // to the wallets for decryption, and to show the correct confirmation
    // modal.
    const nameGroups = await fetchNames(t, nameSuffix, walletAddressMap);
    if (!nameGroups) {
      // This shouldn't happen, but if the owner suddenly has no names anymore,
      // show an error.
      notification.error({
        message: tStr("errorNotifTitle"),
        description: tStr("errorNameRequired")
      });
      setSubmitting(false);
      return;
    }

    // Filter out names owned by the recipient, just in case.
    const filteredNameGroups = nameGroups
      .filter(g => g.wallet.address !== recipient);

    // The names from filteredNameGroups that we actually want to edit
    const namesLUT = buildLUT(names);
    const allNames = filteredNameGroups.flatMap(g => g.names);
    const filteredNames = allNames.filter(n => !!namesLUT[n.key]);

    // All the names owned by the wallets, used for the confirmation modal.
    const allNamesCount = allNames.length;
    const count = filteredNames.length;

    // Don't return this promise, so the confirm modal closes immediately
    const triggerSubmit = () => {
      handleSubmit(filteredNames, recipient, aRecord)
        .catch(onError)
        .finally(() => setSubmitting(false));
    };

    if (mode === "transfer" && count > 1) {
      // If transferring multiple names, prompt for confirmation
      showConfirmModal(
        t, confirmModal,
        count, allNamesCount, recipient!,
        triggerSubmit, setSubmitting
      );
    } else {
      // Otherwise, submit straight away
      triggerSubmit();
    }
  }

  function onValuesChange(_: unknown, values: Partial<FormValues>) {
    setNames(values.names || undefined);
    setRecipient(values.recipient || undefined);
  }

  function closeModal() {
    // Don't allow closing the modal while submitting
    if (submitting) return;

    setVisible(false);
    form.resetFields();
    setNames(undefined);
    setRecipient(undefined);
  }

  const modal = <Modal
    visible={visible}

    title={tStr("modalTitle")}

    onOk={onSubmit}
    okText={tStr("buttonSubmit")}
    okButtonProps={submitting ? { loading: true } : undefined}

    onCancel={closeModal}
    cancelText={t("dialog.cancel")}
    destroyOnClose
  >
    <Form
      form={form}
      layout="vertical"
      className={mode === "transfer"
        ? "name-transfer-form"
        : "name-update-form"}

      name={mode === "transfer" ? "nameTransfer" : "nameUpdate"}

      initialValues={{
        names: name ? [name] : undefined,

        // Start with an initial A record if this is the update name modal
        ...(mode === "update" ? { aRecord } : {})
      }}

      onValuesChange={onValuesChange}
      onFinish={onSubmit}
    >
      {/* Names */}
      <NamePicker
        formName="names"
        label={tStr("labelNames")}
        tabIndex={1}

        filterOwner={mode === "transfer" ? recipient : undefined}
        suppressUpdates={submitting}

        value={names}
        setValue={names => form.setFieldsValue({ names })}

        multiple
        allowAll
      />

      {/* Display the correct input; an address picker for transfer recipients,
        * or a textbox for A records. */}
      {mode === "transfer"
        ? (
          // Transfer - Recipient
          <AddressPicker
            name="recipient"
            label={t("nameTransfer.labelRecipient")}
            tabIndex={2}

            value={recipient}
            suppressUpdates={submitting}

            noNames
            nameHint
          />
        )
        : (
          // Update - A record
          <ARecordInput />
        )}
    </Form>
  </Modal>;

  return <>
    {modal}

    {/* Give the modals somewhere to find the context from. This is done
      * outside of the modal so that they don't get immediately destroyed when
      * the modal closes. */}
    {contextHolder}
    {authFailedContextHolder}
    {notifContextHolder}
  </>;
}