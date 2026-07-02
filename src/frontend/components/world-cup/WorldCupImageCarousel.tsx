'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { WORLD_CUP_CAROUSEL_SLIDES } from '@/shared/config/world-cup-carousel'

export default function WorldCupImageCarousel() {
  const [failedIds, setFailedIds] = useState<string[]>([])
  const slides = useMemo(
    () => WORLD_CUP_CAROUSEL_SLIDES.filter((slide) => !failedIds.includes(slide.id)),
    [failedIds]
  )
  const [activeIndex, setActiveIndex] = useState(0)

  if (!slides.length) return null

  const activeSlide = slides[Math.min(activeIndex, slides.length - 1)]

  function markFailed(id: string) {
    setFailedIds((current) => (current.includes(id) ? current : [...current, id]))
    setActiveIndex(0)
  }

  return (
    <section className="hf-world-carousel" aria-label="Imagenes destacadas del Mundial">
      <div className="hf-world-carousel-frame">
        <Image
          key={activeSlide.id}
          src={activeSlide.src}
          alt={activeSlide.alt}
          width={1440}
          height={640}
          sizes="(min-width: 1024px) 980px, 100vw"
          className="hf-world-carousel-image"
          onError={() => markFailed(activeSlide.id)}
          priority={activeIndex === 0}
        />
      </div>

      {slides.length > 1 ? (
        <div className="hf-world-carousel-dots" aria-label="Cambiar imagen">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={index === activeIndex ? 'is-active' : ''}
              aria-label={`Ver imagen ${index + 1}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
