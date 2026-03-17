import { Complaint } from '../entities/complaint.entity';

export interface ComplaintListResponse {
  data: Complaint[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
