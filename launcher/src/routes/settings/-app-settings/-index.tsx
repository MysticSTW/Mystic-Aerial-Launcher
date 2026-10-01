import { Card, CardContent } from '../../../components/ui/card'
import { AppSettingsBaseForm } from './-base-form'

// Language picker removed, the launcher is English only.
export function AppSettings() {
  return (
    <Card className="w-full">
      <CardContent className="grid pt-6">
        <AppSettingsBaseForm />
      </CardContent>
    </Card>
  )
}
