with open("apps/web/src/components/toast.tsx", "r") as f:
    content = f.read()

content = content.replace(
    '<div role="alert" aria-live="assertive" aria-atomic="true" className="flex flex-col gap-2">\n        {errorToasts.map((t) => (\n          <div key={t.id} className={toastClass(t.type)}>\n            {t.message}\n          </div>\n        ))}\n      </div>',
    '<div aria-live="assertive" className="flex flex-col gap-2">\n        {errorToasts.map((t) => (\n          <div key={t.id} role="alert" className={toastClass(t.type)}>\n            {t.message}\n          </div>\n        ))}\n      </div>'
)

content = content.replace(
    '<div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-2">\n        {otherToasts.map((t) => (\n          <div key={t.id} className={toastClass(t.type)}>\n            {t.message}\n          </div>\n        ))}\n      </div>',
    '<div aria-live="polite" className="flex flex-col gap-2">\n        {otherToasts.map((t) => (\n          <div key={t.id} role="status" className={toastClass(t.type)}>\n            {t.message}\n          </div>\n        ))}\n      </div>'
)

with open("apps/web/src/components/toast.tsx", "w") as f:
    f.write(content)
