import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { WorldBossTabs } from "@/components/WorldBossTabs";
import { getT } from "@/lib/i18n";
import { WorldBossSlotEditor } from "@/components/WorldBossSlotEditor";
import { listMemberSuggestions, listSlotMembers } from "@/lib/world-boss-distribution";
import {
  mapBossKey,
  mirageSlotKey,
  PURGATORY_FLOORS,
  WORLD_BOSS_FFA_BOSSES,
  WORLD_BOSS_LAYERS,
  WORLD_BOSS_MAP_GROUPS,
} from "@/lib/world-boss-maps";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("boss.mapsMetadata") };
}

export const dynamic = "force-dynamic";

export default async function WorldBossDistributionPage() {
  await requireUser();
  const { t } = await getT();
  const assignments = listSlotMembers();
  const memberNames = listMemberSuggestions();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("boss.mapsEyebrow")}</p>
          <h1 className="page-title">{t("boss.mapsTitle")}</h1>
          <p className="page-sub">{t("boss.mapsSub")}</p>
        </div>
      </div>

      <WorldBossTabs active="distribution" />

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("boss.mapsListTitle")}</div>
              <div className="card-sub">{t("boss.mapsListSub")}</div>
            </div>
          </div>
          <div className="card-body wb-map-lists">
            {WORLD_BOSS_MAP_GROUPS.map((group) => (
              <div key={group.key} className="wb-map-group">
                <div className="wb-layer-title">{t(group.titleKey)}</div>
                <div className="table-wrap wb-map-table">
                <table className="data wb-maps">
                  <thead>
                    <tr>
                      <th>{t("boss.mapsTime")}</th>
                      {group.bosses.map((boss) => (
                        <th key={boss.name}>
                          <span className="wb-boss-name">{boss.name}</span>
                          {boss.chests ? (
                            <span className="wb-chest" title={t("boss.mapsChests")}>
                              {boss.chests}
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["dawn", "night"] as const).map((period) => (
                      <tr key={period}>
                        <th scope="row">{t(period === "dawn" ? "boss.mapsDawn" : "boss.mapsNight")}</th>
                        {group.bosses.map((boss, index) => {
                          const slotKey = mapBossKey(group.key, index, period);
                          return (
                            <td key={boss.name}>
                              <WorldBossSlotEditor
                                slotKey={slotKey}
                                chests={boss.chests}
                                members={assignments.get(slotKey) ?? []}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("boss.mapsFfaTitle")}</div>
              <div className="card-sub">{t("boss.mapsFfaSub")}</div>
            </div>
          </div>
          <div className="table-wrap wb-map-table">
            <table className="data wb-maps wb-ffa">
              <thead>
                <tr>
                  {WORLD_BOSS_FFA_BOSSES.map((boss) => (
                    <th key={boss}>{boss}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {WORLD_BOSS_FFA_BOSSES.map((boss) => (
                    <td key={boss}>
                      <span className="badge">{t("boss.mapsFfa")}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("boss.mapsPurgatoryTitle")}</div>
              <div className="card-sub">{t("boss.mapsPurgatorySub")}</div>
            </div>
          </div>
          <div className="card-body wb-floors">
            {PURGATORY_FLOORS.map((floor) => (
              <div key={floor.key} className="wb-floor">
                <div className="wb-floor-head">
                  <span>{floor.label}</span>
                  <span className="badge gold" title={t("boss.mapsMinPower")}>
                    {floor.power}
                  </span>
                </div>
                {floor.times ? (
                  <div className="wb-floor-times">
                    {floor.times.map((time) => (
                      <div key={time.at} className="wb-floor-time">
                        <strong>{time.at}</strong>
                        <span>{t("boss.mapsServer")}</span>
                        {time.power ? <span className="badge">{time.power}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="wb-slot" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("boss.mapsLayersTitle")}</div>
              <div className="card-sub">{t("boss.mapsLayersSub")}</div>
            </div>
          </div>
          <div className="card-body wb-layers">
            {WORLD_BOSS_LAYERS.map((layer) => (
              <div key={layer.key} className="wb-layer">
                <div className="wb-layer-title">{layer.label}</div>
                <div className={`wb-layer-grid cols-${layer.columns}`}>
                  {layer.channels.map((channel) => (
                    <div key={channel} className="wb-channel">
                      <div className="wb-channel-head">
                        <span className="wb-channel-name">{channel}</span>
                        <span className="wb-chest" title={t("boss.mapsChests")}>
                          {layer.chests}
                        </span>
                      </div>
                      <WorldBossSlotEditor
                        slotKey={mirageSlotKey(layer.key, channel)}
                        chests={layer.chests}
                        members={assignments.get(mirageSlotKey(layer.key, channel)) ?? []}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <datalist id="wb-member-names">
        {memberNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
