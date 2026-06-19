import { prisma } from '@/lib/prisma'

export interface PoolMediaInput {
  mediaAssetId: string | null
  creativeUrl: string | null
}

/**
 * Resolve URL gambar buat createAd.
 * Prioritas: mediaAssetId (lookup MediaAsset, harus IMAGE + READY + punya URL) → fileUrl/publicUrl.
 * Fallback: creativeUrl (URL eksternal lama).
 * Return undefined kalau gak ada media valid.
 */
export async function resolvePoolMediaUrl(item: PoolMediaInput): Promise<string | undefined> {
  if (item.mediaAssetId) {
    const a = await prisma.mediaAsset.findUnique({
      where: { id: item.mediaAssetId },
      select: { fileUrl: true, publicUrl: true, type: true, status: true },
    })
    if (a && a.type === 'IMAGE' && a.status === 'READY') {
      const url = a.fileUrl ?? a.publicUrl
      if (url) return url
    }
    // mediaAssetId ada tapi invalid → JANGAN diam-diam pakai creativeUrl yang mungkin null; lanjut fallback
  }
  return item.creativeUrl ?? undefined
}
