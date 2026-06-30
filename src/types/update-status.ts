export type UpdateStatusState =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatus {
  state: UpdateStatusState;
  version?: string;
  percent?: number;
  message?: string;
}
