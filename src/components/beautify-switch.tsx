import { useState } from "react";
import {
  BEAUTIFY_PRESETS,
  applyBeautify,
  readBeautify,
  writeBeautify,
  type BeautifyPreset,
  type BeautifySetting,
} from "@/lib/beautify";

/**
 * 美化开关浮钮(审核用):右下角固定小圆钮,点开面板切换总开关与预设,
 * 方便对比美化前后效果。偏好持久化在 localStorage。
 */
export function BeautifySwitch() {
  const [open, setOpen] = useState(false);
  const [setting, setSetting] = useState<BeautifySetting>(readBeautify);

  const update = (next: BeautifySetting) => {
    setSetting(next);
    writeBeautify(next);
    applyBeautify(next);
  };

  return (
    <div className="fixed bottom-3 right-3 z-[60] flex flex-col items-end gap-2">
      {open ? (
        <div className="glass rounded-2xl p-4 shadow-lg">
          <p className="text-xs font-semibold text-foreground">美化效果</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={setting.on}
              onChange={(e) => update({ ...setting, on: e.target.checked })}
              className="accent-primary"
            />
            启用美化
          </label>
          {setting.on ? (
            <div className="mt-2 flex flex-col gap-1">
              {(Object.entries(BEAUTIFY_PRESETS) as Array<[BeautifyPreset, { label: string }]>).map(
                ([preset, meta]) => (
                  <label
                    key={preset}
                    className="flex cursor-pointer items-center gap-2 text-xs text-muted"
                  >
                    <input
                      type="radio"
                      name="beautify-preset"
                      checked={setting.preset === preset}
                      onChange={() => update({ ...setting, preset })}
                      className="accent-primary"
                    />
                    {preset} · {meta.label}
                  </label>
                ),
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-label="美化设置"
        title="美化设置"
        onClick={() => setOpen((o) => !o)}
        className="glass flex h-10 w-10 items-center justify-center rounded-full text-base shadow-md transition-transform hover:scale-110 active:scale-95"
      >
        {setting.on ? "✨" : "Plain"}
      </button>
    </div>
  );
}
