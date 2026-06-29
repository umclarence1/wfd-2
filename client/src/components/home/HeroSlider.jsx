import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { DEFAULT_SLIDER_SLIDES, getSlideImagePosition } from '../../constants/sliderSlides';
import { SITE_NAME } from '../../constants/brand';

export default function HeroSlider() {
  const { data: apiSliders } = useQuery({
    queryKey: ['sliders'],
    queryFn: () => api.get('/public/sliders').then((r) => r.data.sliders),
    staleTime: 0,
  });

  const sliders = apiSliders?.length ? apiSliders : DEFAULT_SLIDER_SLIDES;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);

  const next = useCallback(() => {
    if (sliders.length) setCurrent((c) => (c + 1) % sliders.length);
  }, [sliders.length]);

  const prev = () => {
    if (sliders.length) setCurrent((c) => (c - 1 + sliders.length) % sliders.length);
  };

  useEffect(() => {
    if (!sliders.length || paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [sliders.length, paused, next]);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    touchStart.current = null;
  };

  if (!sliders.length) return null;

  const slide = sliders[current];
  const imagePosition = getSlideImagePosition(slide);

  return (
    <section
      className="relative overflow-hidden border-b border-gray-200 bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Featured promotions"
    >
      <div className="relative mx-auto h-[min(68vh,640px)] min-h-[440px] max-w-7xl sm:min-h-[480px] md:min-h-[520px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide._id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <img
              src={slide.imageUrl}
              alt=""
              aria-hidden="true"
              className="hero-slide-image h-full w-full object-cover"
              style={{ objectPosition: imagePosition }}
              fetchPriority={current === 0 ? 'high' : 'auto'}
              loading={current === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/10 md:via-white/75 md:to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent md:hidden" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 flex h-full items-end pb-16 sm:items-center sm:pb-0">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${slide._id}-content`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, delay: 0.06 }}
                className="hero-text-panel max-w-lg rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-lg backdrop-blur-sm sm:max-w-xl sm:p-8"
              >
                <span className="section-label">{SITE_NAME}</span>
                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl md:text-4xl lg:text-5xl">
                  {slide.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:mt-4 sm:text-base md:text-lg">
                  {slide.description}
                </p>
                <Link
                  to={slide.buttonUrl || '/services'}
                  className="btn-primary mt-5 w-full sm:mt-6 sm:w-auto"
                >
                  {slide.buttonText || 'Get Started'}
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <button
          type="button"
          onClick={prev}
          className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2.5 text-gray-700 shadow-md transition hover:bg-gray-50 sm:flex md:left-6"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
        </button>
        <button
          type="button"
          onClick={next}
          className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2.5 text-gray-700 shadow-md transition hover:bg-gray-50 sm:flex md:right-6"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
        </button>

        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-6">
          {sliders.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
