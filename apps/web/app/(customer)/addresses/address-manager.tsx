"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AddressForm from "./address-form";

type Address = {
  id: string;
  label: string;
  recipientName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string | null;
  phone: string;
  isDefault: boolean;
};

export default function AddressManager({
  initialAddresses,
}: {
  initialAddresses: Address[];
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFormSuccess() {
    setShowForm(false);
    setEditingAddress(null);
    router.refresh();
  }

  function handleEdit(address: Address) {
    setEditingAddress(address);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingAddress(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/v1/shipping-addresses/${id}`, {
        method: "DELETE",
      });
      setAddresses(addresses.filter((a) => a.id !== id));
      router.refresh();
    } catch {
      // Silently handle
    } finally {
      setDeletingId(null);
    }
  }

  if (showForm) {
    return (
      <AddressForm
        address={editingAddress}
        onSuccess={handleFormSuccess}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <button
        type="button"
        onClick={() => {
          setEditingAddress(null);
          setShowForm(true);
        }}
        className="w-full border border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-black hover:text-black transition flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-base">add</span>
        新規配送先を追加
      </button>

      {/* Address list */}
      {addresses.length === 0 ? (
        <div className="border border-gray-200 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            location_on
          </span>
          <p className="text-sm text-gray-400">配送先が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => {
            const isDeleting = deletingId === address.id;
            return (
              <div
                key={address.id}
                className={`border border-gray-200 p-5 transition ${
                  isDeleting ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-black">
                        {address.label}
                      </span>
                      {address.isDefault && (
                        <span className="text-xs bg-black text-white px-2 py-0.5">
                          デフォルト
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-gray-400">
                          person
                        </span>
                        {address.recipientName}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-gray-400">
                          mail
                        </span>
                        〒{address.postalCode}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-gray-400">
                          location_on
                        </span>
                        {address.prefecture}
                        {address.city}
                        {address.addressLine1}
                        {address.addressLine2 && ` ${address.addressLine2}`}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-gray-400">
                          phone
                        </span>
                        {address.phone}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(address)}
                      disabled={isDeleting}
                      className="p-2 border border-gray-200 hover:border-black transition disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(address.id)}
                      disabled={isDeleting}
                      className="p-2 border border-gray-200 hover:border-red-500 hover:text-red-500 transition disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
