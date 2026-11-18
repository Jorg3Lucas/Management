"use client";

import { useState, useTransition, type FormEvent } from "react";
import { saveSlotMembersAction } from "@/app/world-boss/distribution/actions";
import { useT } from "@/components/I18nProvider";
import { MAX_SLOT_MEMBERS, splitChests } from "@/lib/world-boss-maps";

type Props = {
  slotKey: string;
  /** Baús do mapa por horário; sem valor, o mapa não reparte nada. */
  chests?: number;
  members: string[];
};

/**
 * Escalação de um mapa do World Boss: até 3 membros por horário, com os baús
 * do mapa divididos entre eles. Salva a cada adição/remoção.
 */
export function WorldBossSlotEditor({ slotKey, chests, members: initial }: Props) {
  const { t } = useT();
  const [members, setMembers] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const shares = splitChests(chests ?? 0, members.length);
  const full = members.length >= MAX_SLOT_MEMBERS;

  const persist = (next: string[], previous: string[]) => {
    setMembers(next);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveSlotMembersAction(slotKey, next);
        if (result.ok) {
          setMembers(result.members);
        } else {
          setMembers(previous);
          setError(result.error);
        }
      } catch (saveError) {
        console.error("world boss slot save failed", saveError);
        setMembers(previous);
        setError(t("boss.slotError"));
      }
    });
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) return;
    if (full) {
      setError(t("boss.slotFull"));
      return;
    }
    setDraft("");
    if (members.some((member) => member.toLowerCase() === name.toLowerCase())) return;
    persist([...members, name], members);
  };

  const remove = (name: string) => {
    persist(
      members.filter((member) => member !== name),
      members,
    );
  };

  return (
    <div className={`wb-slot-editor${pending ? " busy" : ""}`}>
      {members.length ? (
        <ul className="wb-members">
          {members.map((member, index) => (
            <li key={member} className="wb-member">
              <span className="wb-member-name" title={member}>
                {member}
              </span>
              {chests ? (
                <span className="wb-member-share" title={t("boss.slotShare")}>
                  {shares[index]}
                </span>
              ) : null}
              <button
                type="button"
                className="wb-member-remove"
                aria-label={`${t("boss.slotRemove")} ${member}`}
                onClick={() => remove(member)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? null : (
        <form className="wb-slot-add" onSubmit={add}>
          <input
            type="text"
            list="wb-member-names"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("boss.slotPlaceholder")}
            aria-label={t("boss.slotAdd")}
            maxLength={40}
            autoComplete="off"
          />
          <button type="submit" className="btn ghost sm" aria-label={t("boss.slotAdd")}>
            +
          </button>
        </form>
      )}

      {error ? (
        <p className="wb-slot-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
