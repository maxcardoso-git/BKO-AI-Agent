import type { Complaint } from '@/lib/types'

interface TicketDetailsProps {
  complaint: Complaint
}

export function TicketDetails({ complaint }: TicketDetailsProps) {
  const details = complaint.details ?? []
  const attachments = complaint.attachments ?? []

  return (
    <div className="space-y-4">
      {/* Solicitação */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Solicitação</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {complaint.rawText}
        </p>
      </section>

      {/* Detalhes extraídos */}
      {details.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Detalhes</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.id} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {detail.fieldName}
                </dt>
                <dd className="text-sm">
                  {detail.fieldValue}
                  {detail.confidence !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({Math.round(detail.confidence * 100)}% confiança)
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Anexos */}
      {attachments.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Anexos</h2>
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {attachment.fileName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({attachment.mimeType})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
