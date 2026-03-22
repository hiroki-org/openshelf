import * as React from "react"

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={`block text-sm font-medium mb-1 ${className || ""}`}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label }
