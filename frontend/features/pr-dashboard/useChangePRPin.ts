"use client";

import { useState } from "react";
import { changePRPin } from "@/lib/api/members";

export function useChangePRPin() {
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  function openPinModal() {
    setPinError("");
    setPinSuccess("");
    setPinModalOpen(true);
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setPinSuccess("");
    if (!newPin || newPin.length < 4) {
      setPinError("New PIN must be at least 4 digits");
      return;
    }

    setChangingPin(true);
    try {
      await changePRPin(newPin, oldPin || undefined);
      setPinSuccess("Your PIN has been updated successfully!");
      setOldPin("");
      setNewPin("");
      setTimeout(() => {
        setPinModalOpen(false);
        setPinSuccess("");
      }, 1500);
    } catch (err: any) {
      setPinError(err.message || "Failed to update PIN");
    } finally {
      setChangingPin(false);
    }
  }

  return {
    pinModalOpen,
    oldPin,
    newPin,
    showOldPin,
    showNewPin,
    pinError,
    pinSuccess,
    changingPin,
    openPinModal,
    setPinModalOpen,
    setOldPin,
    setNewPin,
    setShowOldPin,
    setShowNewPin,
    handlePinChange,
  };
}
